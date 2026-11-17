#!/usr/bin/env python3
"""Decode the verified LOLA LDEM_4 JP2 and emit raw-pixel diagnostics only.

This script intentionally does not apply PDS scale/offset, infer NoData, or
interpret the decoded values as validated elevation or radius.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

EXPECTED = {
    "jp2": {
        "bytes": 1_436_447,
        "sha256": "9193828F6FC311E858A9F30CA8A29F91948805993A1475C6D2165E290F167FE3",
    },
    "label": {
        "bytes": 6_602,
        "sha256": "102122E68A0CCA9106FE0067D2E5027714D244FFDEC87F04FA292A211F0EF4C8",
    },
}
OFFICIAL_JP2 = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2"
OFFICIAL_LABEL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4_jp2.lbl"
SAMPLE_POSITIONS = ((0, 0), (0, 9), (1, 0), (359, 719), (719, 1439))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def verify_file(path: Path, kind: str) -> dict[str, object]:
    expected = EXPECTED[kind]
    if not path.is_file():
        raise ValueError(f"{kind} source file does not exist or is not a regular file")
    size = path.stat().st_size
    if size != expected["bytes"]:
        raise ValueError(f"{kind} source size mismatch: expected {expected['bytes']}, observed {size}")
    digest = sha256_file(path)
    if digest != expected["sha256"]:
        raise ValueError(f"{kind} source SHA-256 mismatch")
    return {"filename": path.name, "byteSize": size, "sha256": digest, "expectedIntegrityMatched": True}


def field(text: str, name: str) -> str | None:
    match = re.search(rf"^\s*{re.escape(name)}\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\r\n/]+))", text, re.I | re.M)
    value = next((group for group in match.groups() if group is not None), None) if match else None
    return value.strip() if value is not None else None


def number(text: str, name: str) -> float | None:
    value = field(text, name)
    if value is None:
        return None
    match = re.match(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", value)
    return float(match.group(0)) if match else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jp2", required=True, type=Path, help="Verified source JP2")
    parser.add_argument("--label", required=True, type=Path, help="Detached PDS3 label")
    parser.add_argument("--diagnostics", required=True, type=Path, help="New JSON diagnostics output path")
    args = parser.parse_args()

    jp2_info = verify_file(args.jp2, "jp2")
    label_info = verify_file(args.label, "label")
    if args.diagnostics.resolve() in {args.jp2.resolve(), args.label.resolve()}:
        raise ValueError("diagnostics output must not overwrite either source file")
    if args.diagnostics.exists():
        raise FileExistsError("diagnostics output already exists; refusing to overwrite it")

    import imagecodecs
    import numpy as np

    label_text = args.label.read_text(encoding="ascii", errors="strict")
    if field(label_text, "PDS_VERSION_ID") != "PDS3":
        raise ValueError("detached label is not PDS3")
    expected_height = int(number(label_text, "LINES") or 0)
    expected_width = int(number(label_text, "LINE_SAMPLES") or 0)
    if (expected_height, expected_width) != (720, 1440):
        raise ValueError("PDS image dimensions do not match the verified LDEM_4 dimensions")

    samples = imagecodecs.jpeg2k_decode(args.jp2.read_bytes())
    if not isinstance(samples, np.ndarray):
        raise TypeError("JPEG 2000 decoder did not return a NumPy array")
    if samples.shape != (expected_height, expected_width):
        raise ValueError(f"decoded dimensions mismatch: observed {samples.shape}, expected {(expected_height, expected_width)}")
    if samples.dtype.kind != "i" or samples.dtype.itemsize != 2:
        raise TypeError(f"decoded samples are not signed 16-bit integers: {samples.dtype}")

    raw_min = int(samples.min())
    raw_max = int(samples.max())
    quantiles = np.percentile(samples, [1, 5, 25, 50, 75, 95, 99], method="linear")
    samples_read = [{"rowZeroBased": row, "columnZeroBased": column, "rawValue": int(samples[row, column])} for row, column in SAMPLE_POSITIONS]
    pds_min = number(label_text, "MINIMUM")
    pds_max = number(label_text, "MAXIMUM")
    pds_scale = number(label_text, "SCALING_FACTOR")
    pds_offset = number(label_text, "OFFSET")

    diagnostics = {
        "schemaVersion": "1.0.0",
        "product": {"datasetId": "moon-lola-global-topography", "productId": field(label_text, "PRODUCT_ID"), "productVersion": field(label_text, "PRODUCT_VERSION_ID"), "dataSetId": field(label_text, "DATA_SET_ID")},
        "source": {"jp2": {**jp2_info, "officialUrl": OFFICIAL_JP2}, "label": {**label_info, "officialUrl": OFFICIAL_LABEL}},
        "execution": {"executedAtUtc": datetime.now(timezone.utc).isoformat(), "pythonVersion": __import__("platform").python_version(), "imagecodecsVersion": imagecodecs.__version__, "numpyVersion": np.__version__, "decoder": "imagecodecs.jpeg2k_decode"},
        "decodedFacts": {
            "decodeSucceeded": True, "shapeLinesSamples": list(samples.shape), "dtype": str(samples.dtype), "sampleKind": "signed integer", "sampleBits": 16,
            "totalSampleCount": int(samples.size), "finiteSampleCount": int(np.isfinite(samples).sum()),
            "rawStatistics": {"minimum": raw_min, "maximum": raw_max, "mean": float(samples.mean(dtype=np.float64)), "standardDeviationPopulation": float(samples.std(dtype=np.float64)), "median": float(np.median(samples)), "percentiles": {str(percentile): float(value) for percentile, value in zip((1, 5, 25, 50, 75, 95, 99), quantiles)}},
            "extremeSampleCounts": {"minimumValue": raw_min, "minimumCount": int(np.count_nonzero(samples == raw_min)), "maximumValue": raw_max, "maximumCount": int(np.count_nonzero(samples == raw_max))},
            "samplePositions": {"indexing": "zero-based row, column; raw decoder samples; no physical transform", "values": samples_read},
            "firstFiveRowsFirstTenColumns": samples[:5, :10].astype(int).tolist(),
        },
        "pdsLabelDeclarations": {
            "declaredLines": expected_height, "declaredLineSamples": expected_width, "sampleType": field(label_text, "SAMPLE_TYPE"), "sampleBits": number(label_text, "SAMPLE_BITS"),
            "declaredMinimum": pds_min, "declaredMaximum": pds_max, "decodedExtremaMatchLabel": raw_min == pds_min and raw_max == pds_max,
            "unit": field(label_text, "UNIT"), "scalingFactor": pds_scale, "offset": pds_offset,
            "missingConstantPresent": field(label_text, "MISSING_CONSTANT") is not None, "missingValuePresent": field(label_text, "MISSING_VALUE") is not None,
            "projection": field(label_text, "MAP_PROJECTION_TYPE"), "coordinateSystem": field(label_text, "COORDINATE_SYSTEM_NAME"),
            "positiveLongitudeDirection": field(label_text, "POSITIVE_LONGITUDE_DIRECTION"), "longitudeBounds": {"west": number(label_text, "WESTERNMOST_LONGITUDE"), "east": number(label_text, "EASTERNMOST_LONGITUDE")},
            "latitudeBounds": {"minimum": number(label_text, "MINIMUM_LATITUDE"), "maximum": number(label_text, "MAXIMUM_LATITUDE")},
            "lineProjectionOffsetPixels": number(label_text, "LINE_PROJECTION_OFFSET"), "sampleProjectionOffsetPixels": number(label_text, "SAMPLE_PROJECTION_OFFSET"),
            "pixelRegistrationDeclared": "pixel registered" in (field(label_text, "DESCRIPTION") or "").lower() or "pixel registered" in label_text.lower(),
            "labelHasExplicitLatitudeType": field(label_text, "LATITUDE_TYPE") is not None,
        },
        "unresolvedInterpretations": [
            "The label uses both shape-map (radius) wording and an IMAGE object named HEIGHT relative to the reference-radius offset; raw decoded samples are not classified here as elevation or absolute radius.",
            "The label provides scale factor and offset, but this diagnostic does not apply them as an authoritative physical interpretation.",
            "The label contains no MISSING_CONSTANT or MISSING_VALUE; no fill/NoData rule, valid-pixel count, or valid coverage is inferred.",
            "The label does not declare planetocentric versus planetographic latitude; latitude type remains unresolved.",
            "Pixel registration and projection offsets are recorded, but pixel-center coordinate mapping and row/column orientation are not independently verified.",
            "Declared global grid bounds do not establish valid observational coverage; label notes 45-degree band edge artifacts and interpolation used to compensate for incomplete coverage.",
            "Raw minimum and maximum match the label declarations; this agreement alone is not scientific validation.",
        ],
        "processingStatus": {"processed": False, "scientificallyValidated": False, "deliveryReady": False, "renderable": False, "mapReady": False, "physicalTransformApplied": False},
    }

    output = args.diagnostics.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output.parent, prefix=".lola-diagnostics-", suffix=".tmp", delete=False) as temporary:
            temporary_name = temporary.name
            json.dump(diagnostics, temporary, indent=2, allow_nan=False)
            temporary.write("\n")
        if output.exists():
            raise FileExistsError("diagnostics output appeared during execution; refusing to overwrite it")
        os.replace(temporary_name, output)
        temporary_name = None
    finally:
        if temporary_name is not None:
            try:
                os.unlink(temporary_name)
            except FileNotFoundError:
                pass

    print(json.dumps({"status": "decoded", "outputFilename": output.name, "shape": samples.shape, "dtype": str(samples.dtype), "minimum": raw_min, "maximum": raw_max, "diagnosticByteSize": output.stat().st_size}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # safe summary; no source paths or payloads
        print(f"LOLA decode failed: {type(error).__name__}: {error}", file=__import__("sys").stderr)
        raise SystemExit(1)
