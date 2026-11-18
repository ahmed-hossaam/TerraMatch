#!/usr/bin/env python3
"""Process LDEM_4 raw JP2 DNs into relative-height Float32 samples.

The resulting NumPy array is not georeferenced, scientifically validated, or
ready for map delivery. Source files are verified and never modified.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

EXPECTED = {
    "jp2": (1_436_447, "9193828F6FC311E858A9F30CA8A29F91948805993A1475C6D2165E290F167FE3"),
    "label": (6_602, "102122E68A0CCA9106FE0067D2E5027714D244FFDEC87F04FA292A211F0EF4C8"),
}
JP2_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2"
LABEL_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4_jp2.lbl"


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().upper()


def verify_source(path: Path, key: str) -> dict[str, object]:
    size, sha = EXPECTED[key]
    if not path.is_file() or path.stat().st_size != size:
        raise ValueError(f"{key} source is missing or has an unexpected byte size")
    actual = digest(path)
    if actual != sha:
        raise ValueError(f"{key} source SHA-256 mismatch")
    return {"filename": path.name, "byteSize": size, "sha256": actual, "expectedIntegrityMatched": True}


def label_value(text: str, key: str) -> str | None:
    match = re.search(rf"^\s*{re.escape(key)}\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^/\r\n]+))", text, re.I | re.M)
    if not match:
        return None
    return next(group for group in match.groups() if group is not None).strip()


def numeric_label_value(text: str, key: str) -> float | None:
    value = label_value(text, key)
    match = re.match(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", value or "")
    return float(match.group(0)) if match else None


def parse_aux(path: Path) -> dict[str, object]:
    try:
        root = ET.parse(path).getroot()
    except (ET.ParseError, OSError) as exc:
        raise ValueError(f"AUX XML could not be parsed: {type(exc).__name__}") from exc
    band = root.find("./PAMRasterBand")
    if band is None:
        raise ValueError("AUX XML is missing PAMRasterBand")
    try:
        nodata = float(band.findtext("NoDataValue", "nan"))
        scale = float(band.findtext("Scale", "nan"))
        offset = float(band.findtext("Offset", "nan"))
    except ValueError as exc:
        raise ValueError("AUX NoData/Scale/Offset values are malformed") from exc
    if (nodata, scale, offset) != (-32768.0, 0.5, 0.0):
        raise ValueError("AUX NoData/Scale/Offset do not match the reviewed LDEM_4 declarations")
    actual_range_text = band.find("./Metadata/MDI[@key='actual_range']")
    if actual_range_text is None or not actual_range_text.text:
        raise ValueError("AUX XML is missing actual_range metadata")
    values = re.findall(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", actual_range_text.text)
    if len(values) != 2:
        raise ValueError("AUX actual_range must contain exactly two numeric bounds")
    return {"noDataValue": int(nodata), "scale": scale, "offset": offset, "actualRange": {"minimum": float(values[0]), "maximum": float(values[1])}}


def process_samples(samples, *, nodata_value: int, scale: float):
    """Pure transformation helper; callers provide an actual or test array."""
    import numpy as np
    if samples.ndim != 2 or samples.dtype.kind != "i" or samples.dtype.itemsize != 2:
        raise TypeError("Input samples must be a two-dimensional signed 16-bit array")
    if not np.isfinite(scale):
        raise ValueError("Scale must be finite")
    nodata_mask = samples == nodata_value
    output = samples.astype(np.float32)
    output *= np.float32(scale)
    output[nodata_mask] = np.nan
    return output, nodata_mask


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jp2", required=True, type=Path)
    parser.add_argument("--label", required=True, type=Path)
    parser.add_argument("--aux", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path, help="New processed .npy output")
    parser.add_argument("--metadata", required=True, type=Path, help="New JSON sidecar output")
    return parser


def main() -> int:
    args = create_parser().parse_args()
    jp2_source = verify_source(args.jp2, "jp2")
    label_source = verify_source(args.label, "label")
    if not args.aux.is_file():
        raise ValueError("AUX XML source file is missing")
    aux_sha = digest(args.aux)
    for source in (args.jp2.resolve(), args.label.resolve(), args.aux.resolve()):
        if source in {args.output.resolve(), args.metadata.resolve()}:
            raise ValueError("output paths must not overwrite source files")
    if args.output.exists() or args.metadata.exists():
        raise FileExistsError("processed output or metadata already exists; refusing to overwrite")

    import imagecodecs
    import numpy as np

    label_text = args.label.read_text(encoding="ascii", errors="strict")
    if label_value(label_text, "PDS_VERSION_ID") != "PDS3" or label_value(label_text, "PRODUCT_ID") != "LDEM_4":
        raise ValueError("unexpected PDS label or product identity")
    height = int(numeric_label_value(label_text, "LINES") or 0)
    width = int(numeric_label_value(label_text, "LINE_SAMPLES") or 0)
    label_bits = numeric_label_value(label_text, "SAMPLE_BITS")
    if (height, width, label_bits) != (720, 1440, 16):
        raise ValueError("PDS dimensions or sample precision do not match the verified product")
    aux = parse_aux(args.aux)
    decoded = imagecodecs.jpeg2k_decode(args.jp2.read_bytes())
    if not isinstance(decoded, np.ndarray) or decoded.shape != (height, width) or decoded.dtype.kind != "i" or decoded.dtype.itemsize != 2:
        raise TypeError("JP2 decoder result does not match the 720x1440 signed-16-bit PDS image")

    processed, nodata_mask = process_samples(decoded, nodata_value=int(aux["noDataValue"]), scale=float(aux["scale"]))
    nodata_locations = np.argwhere(nodata_mask)
    valid = processed[~nodata_mask]
    if valid.size == 0 or not np.isfinite(valid).all():
        raise ValueError("processed grid contains no finite valid samples")
    actual = aux["actualRange"]
    raw_valid = decoded[~nodata_mask].astype(np.float64)
    if abs(float(raw_valid.min()) - float(actual["minimum"])) > 1.0 or abs(float(raw_valid.max()) - float(actual["maximum"])) > 1.0:
        raise ValueError("AUX actual_range differs from decoded raw valid extrema by more than 1 DN")
    q_values = np.percentile(valid, [1, 5, 25, 50, 75, 95, 99], method="linear")
    stats = {
        "minimum": float(valid.min()), "maximum": float(valid.max()), "mean": float(valid.mean(dtype=np.float64)),
        "standardDeviationPopulation": float(valid.std(dtype=np.float64)), "median": float(np.median(valid)),
        "percentiles": {str(k): float(v) for k, v in zip((1, 5, 25, 50, 75, 95, 99), q_values)},
    }
    output = args.output.resolve()
    metadata_path = args.metadata.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    output_tmp = metadata_tmp = None
    output_promoted = False
    try:
        with tempfile.NamedTemporaryFile("wb", dir=output.parent, prefix=".ldem4-height-", suffix=".tmp", delete=False) as f:
            output_tmp = Path(f.name)
            np.save(f, processed, allow_pickle=False)
            f.flush(); os.fsync(f.fileno())
        output_sha = digest(output_tmp)
        output_size = output_tmp.stat().st_size
        metadata = {
            "schemaVersion": "1.0.0", "product": {"datasetId": "moon-lola-global-topography", "productId": "LDEM_4", "productVersion": "V3.0", "dataSetId": "LRO-L-LOLA-4-GDR-V1.0"},
            "sources": {"jp2": {**jp2_source, "officialUrl": JP2_URL}, "pdsLabel": {**label_source, "officialUrl": LABEL_URL}, "auxXml": {"filename": args.aux.name, "byteSize": args.aux.stat().st_size, "sha256": aux_sha, "sha256Observed": True}},
            "inputArray": {"dimensionsLinesSamples": [height, width], "dtype": str(decoded.dtype), "sampleBits": 16, "sampleTypeDeclaredByPds": label_value(label_text, "SAMPLE_TYPE")},
            "output": {"filename": output.name, "format": "NumPy .npy", "dimensionsLinesSamples": list(processed.shape), "dtype": str(processed.dtype), "byteSize": output_size, "sha256": output_sha, "units": "m", "variable": "relative surface height above the 1,737,400 m reference sphere"},
            "transform": {"noDataRule": f"Raw DN equal to AUX NoDataValue {int(aux['noDataValue'])} becomes Float32 NaN; excluded from statistics.", "scaleApplied": float(aux["scale"]), "offsetApplied": float(aux["offset"]), "formula": "relative surface height (m) = raw DN × 0.5", "referenceRadiusM": 1_737_400, "referenceRadiusAppliedToOutput": False, "planetaryRadiusFormulaNotApplied": "planetary radius (m) = raw DN × 0.5 + 1,737,400"},
            "coordinateMetadata": {"targetBody": "Moon", "referenceFrame": label_value(label_text, "COORDINATE_SYSTEM_NAME"), "projection": label_value(label_text, "MAP_PROJECTION_TYPE"), "longitudeDirection": label_value(label_text, "POSITIVE_LONGITUDE_DIRECTION"), "longitudeBoundsDegrees": [-180, 180], "latitudeBoundsDegrees": [-90, 90], "resolutionPixelsPerDegree": numeric_label_value(label_text, "MAP_RESOLUTION"), "referenceRadiusM": 1_737_400, "latitudeConvention": "planetocentric per LOLA RDR SIS coordinate-system definition; not stated in this detached image label", "pixelRegistration": "pixel centers represent cell centers per PDS LOLA GDRDEM documentation", "pixelCenterAndOrientation": "zero-based column increases east; row 0 is north and rows increase south, from LDEM_4 projection offsets", "pixelCenterEquations": {"longitude": "(column - 719.5) / 4", "latitude": "(359.5 - row) / 4"}, "pixelSizeDegrees": [0.25, 0.25], "geotransform": None, "georeferenced": False, "spatialMetadataSources": [{"title": "LOLA RDR SIS, section 2.4.3 Coordinate Systems", "url": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/document/rdrsis.htm"}, {"title": "LOLA GDRDEM product description", "url": "https://ode.rsl.wustl.edu/MArs/pagehelp/Content/Missions_Instruments/Lunar%20Reconnaissance%20Orbiter%20%28LRO%29/LOLA/GDR/GDRDEM.htm"}]},
            "coverageAndStatistics": {"sampleCount": int(decoded.size), "validSampleCount": int(valid.size), "noDataSampleCount": int(nodata_mask.sum()), "noDataLocationsRowColumnZeroBased": nodata_locations.tolist(), "noDataLocationsEncoding": "list of [row, column] pairs; zero-based", "validSampleStatistics": stats, "geographicValidCoverage": None, "coverageInterpretation": "sample validity under AUX NoData rule only; not an area/coverage estimate"},
            "auxMetadata": {"noDataValue": int(aux["noDataValue"]), "scale": float(aux["scale"]), "offset": float(aux["offset"]), "actualRangeRawDn": actual, "actualRangeAgreement": "decoded non-NoData raw extrema are within 1 DN of AUX actual_range"},
            "processing": {"processedAtUtc": datetime.now(timezone.utc).isoformat(), "script": "scripts/moon/process-lola-height.py", "scriptVersion": "1.0.0", "pythonVersion": __import__("platform").python_version(), "imagecodecsVersion": imagecodecs.__version__, "numpyVersion": np.__version__, "decoder": "imagecodecs.jpeg2k_decode", "reproducibleCommand": "<ISOLATED_PYTHON_EXECUTABLE> scripts/moon/process-lola-height.py --jp2 <LOLA_CACHE>/ldem_4.jp2 --label <LOLA_CACHE>/ldem_4_jp2.lbl --aux <LOLA_CACHE>/ldem_4_aux.xml --output data/processed/moon/lola/ldem_4_height_m.npy --metadata data/processed/moon/lola/ldem_4_height_m.json"},
            "unresolvedScientificDetails": ["NoData is taken from the supplied companion AUX XML; no additional quality mask was available.", "The PDS label describes a shape map and relative height; output follows the AUX scale without adding the radius offset.", "No independent LOLA RDR point comparison has validated this processed grid; scientific validation remains incomplete.", "The product is binned/interpolated; valid observed versus interpolated geographic coverage is not computed, and noted latitude-band edge artifacts were not assessed."],
            "lifecycle": {"sourceAcquired": True, "sourceChecksumsVerified": True, "auxParsed": True, "pixelsDecoded": True, "processed": True, "scientificallyValidated": False, "deliveryReady": False, "renderable": False, "mapReady": False},
        }
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=metadata_path.parent, prefix=".ldem4-metadata-", suffix=".tmp", delete=False) as f:
            metadata_tmp = Path(f.name)
            json.dump(metadata, f, indent=2, allow_nan=False); f.write("\n"); f.flush(); os.fsync(f.fileno())
        if output.exists() or metadata_path.exists():
            raise FileExistsError("processed output appeared during processing; refusing to overwrite")
        os.replace(output_tmp, output); output_tmp = None; output_promoted = True
        os.replace(metadata_tmp, metadata_path); metadata_tmp = None
    except Exception:
        if output_promoted and output.exists() and not metadata_path.exists():
            output.unlink()
        raise
    finally:
        for temporary in (output_tmp, metadata_tmp):
            if temporary and temporary.exists():
                temporary.unlink()

    # Validate the persisted artifact, not just the in-memory array.
    reopened = np.load(output, mmap_mode="r", allow_pickle=False)
    if reopened.shape != (720, 1440) or reopened.dtype != np.dtype("float32") or int(np.isnan(reopened).sum()) != int(nodata_mask.sum()):
        raise RuntimeError("saved Float32 NPY failed dimensions, dtype, or NaN-count verification")
    if digest(output) != output_sha:
        raise RuntimeError("saved NPY checksum does not match the metadata sidecar")
    print(json.dumps({"status": "processed", "output": output.name, "metadata": metadata_path.name, "validSampleCount": int(valid.size), "noDataSampleCount": int(nodata_mask.sum()), "outputByteSize": output_size, "outputSha256": output_sha, "minimumM": stats["minimum"], "maximumM": stats["maximum"]}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"LOLA processing failed: {type(error).__name__}: {error}", file=__import__("sys").stderr)
        raise SystemExit(1)
