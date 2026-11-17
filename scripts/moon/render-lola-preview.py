#!/usr/bin/env python3
"""Render a compact, non-scientifically-validated PNG preview from LDEM_4 height NPY.

This creates a display derivative only. It does not write or georeference the
source array, infer valid observation coverage, or change product lifecycle.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import struct
import tempfile
import zlib
from pathlib import Path

EXPECTED_NPY_SHA256 = "6D750B3134F9F8272913E70793F3140DC6CE2FD857865BD9F28DD7885123D417"
EXPECTED_SHAPE = (720, 1440)
LOW_M = -5320.5  # Existing processed sidecar's 1st percentile.
HIGH_M = 5681.0  # Existing processed sidecar's 99th percentile.
NO_DATA_RULE = "Non-finite Float32 values are transparent; finite samples are rendered."
ANCHORS = ((0.0, (24, 65, 92)), (0.5, (190, 190, 177)), (1.0, (178, 78, 46)))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def color(value: float) -> tuple[int, int, int, int]:
    normalized = min(1.0, max(0.0, (value - LOW_M) / (HIGH_M - LOW_M)))
    left, right = (ANCHORS[0], ANCHORS[1]) if normalized <= 0.5 else (ANCHORS[1], ANCHORS[2])
    fraction = (normalized - left[0]) / (right[0] - left[0])
    rgb = tuple(round(a + (b - a) * fraction) for a, b in zip(left[1], right[1]))
    return (*rgb, 255)


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    checksum = zlib.crc32(kind + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)


def encode_png(rows: list[bytes], width: int, height: int) -> bytes:
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # RGBA, 8 bit.
    compressed = zlib.compress(b"".join(b"\x00" + row for row in rows), level=9)
    return b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header) + png_chunk(b"IDAT", compressed) + png_chunk(b"IEND", b"")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--input", type=Path, default=Path("data/processed/moon/lola/ldem_4_height_m.npy"))
    result.add_argument("--input-metadata", type=Path, default=Path("data/processed/moon/lola/ldem_4_height_m.json"))
    result.add_argument("--output", type=Path, default=Path("data/processed/moon/lola/ldem_4_relative-height-preview.png"))
    result.add_argument("--metadata", type=Path, default=Path("data/processed/moon/lola/ldem_4_relative-height-preview.json"))
    return result


def main() -> int:
    args = parser().parse_args()
    if args.output.exists() or args.metadata.exists():
        raise FileExistsError("Refusing to overwrite an existing preview artifact or sidecar.")
    if sha256(args.input) != EXPECTED_NPY_SHA256:
        raise ValueError("Processed LOLA input checksum differs from the reviewed source artifact.")
    with args.input_metadata.open(encoding="utf-8") as stream:
        source_metadata = json.load(stream)
    if source_metadata.get("output", {}).get("sha256", "").upper() != EXPECTED_NPY_SHA256:
        raise ValueError("Processed sidecar does not identify the expected source array.")

    import numpy as np

    values = np.load(args.input, mmap_mode="r", allow_pickle=False)
    if values.shape != EXPECTED_SHAPE or values.dtype != np.dtype("float32"):
        raise ValueError("LOLA processed input must remain the expected 720x1440 Float32 array.")
    rows: list[bytes] = []
    finite_count = 0
    for row in values:
        output = bytearray()
        for sample in row:
            value = float(sample)
            if math.isfinite(value):
                output.extend(color(value))
                finite_count += 1
            else:
                output.extend((0, 0, 0, 0))
        rows.append(bytes(output))
    png = encode_png(rows, EXPECTED_SHAPE[1], EXPECTED_SHAPE[0])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.metadata.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        "schemaVersion": "1.0.0",
        "artifactId": "moon-lola-ldem-4-relative-height-display-preview-v1",
        "kind": "display_preview_not_scientific_validation",
        "input": {"productId": "LDEM_4", "version": "V3.0", "path": "data/processed/moon/lola/ldem_4_height_m.npy", "sha256": EXPECTED_NPY_SHA256, "dimensionsLinesSamples": list(EXPECTED_SHAPE), "dtype": "float32", "units": "m relative surface height"},
        "output": {"path": args.output.as_posix(), "format": "PNG RGBA 8-bit", "width": EXPECTED_SHAPE[1], "height": EXPECTED_SHAPE[0], "byteSize": len(png), "sha256": hashlib.sha256(png).hexdigest().upper()},
        "coordinateReference": {"body": "Moon", "frame": "MEAN EARTH/POLAR AXIS OF DE421", "projection": "simple cylindrical / equirectangular display", "latitudeType": "planetocentric per LOLA RDR SIS; inherited from product family, not declared in detached image label", "longitudeDirection": "positive east", "longitudeBoundsDegrees": [-180, 180], "latitudeBoundsDegrees": [-90, 90], "pixelRegistration": "area pixel; integral line/sample denotes center", "pixelSizeDegrees": [0.25, 0.25], "zeroBasedPixelCenterEquations": {"longitude": "(column - 719.5) / 4", "latitude": "(359.5 - row) / 4"}, "rowOrientation": "row 0 north; rows increase southward", "columnOrientation": "column 0 westernmost; columns increase eastward", "referenceRadiusM": 1737400, "geotiffCrsAssigned": False},
        "display": {"variable": "relative surface height", "units": "m", "rangeM": [LOW_M, HIGH_M], "rangeMethod": "Existing processed artifact 1st and 99th percentiles; values outside are clipped for display only.", "paletteAnchors": [{"fraction": point, "rgb": list(rgb)} for point, rgb in ANCHORS], "noDataPolicy": NO_DATA_RULE, "finiteSampleCount": finite_count, "transparentSampleCount": int(values.size - finite_count), "sourceArrayValuesModified": False},
        "scientificStatus": {"processedInput": True, "spatialMappingDocumented": True, "independentPointCrossCheck": False, "scientificallyValidated": False, "deliveryReady": False, "renderableAsValidatedLayer": False, "mapReady": False, "previewLabel": "UNVALIDATED RESEARCH PREVIEW", "coverage": "The product is a gridded/interpolated GDR; this image does not imply complete observed coverage."},
        "provenance": {"sourceDataset": "LRO-L-LOLA-4-GDR-V1.0", "sourceProduct": "LDEM_4 V3.0", "sourceUrl": source_metadata["sources"]["jp2"]["officialUrl"], "pdsLabelUrl": source_metadata["sources"]["pdsLabel"]["officialUrl"], "processingScript": "scripts/moon/render-lola-preview.py", "processingVersion": "1.0.0", "numpyVersion": np.__version__, "noDataRule": NO_DATA_RULE, "processing": "Colorize existing relative-height Float32 samples row-for-row; no resampling, flip, transpose, radius addition, or physical-value modification."},
        "limitations": ["PNG colors encode relative elevation for visual display only and are not scientific measurements.", "The 1st–99th percentile display range clips image colors, not source values.", "No independent RDR point comparison has been completed.", "The grid is binned/interpolated and its rendered pixels do not establish observation coverage or artifact-free terrain.", "No Earth EPSG code or GeoTIFF CRS is assigned; this is a coordinate-addressed PNG display derivative."],
    }
    output_tmp = metadata_tmp = None
    promoted = False
    try:
        with tempfile.NamedTemporaryFile("wb", dir=args.output.parent, prefix=".lola-preview-", suffix=".tmp", delete=False) as stream:
            output_tmp = Path(stream.name)
            stream.write(png); stream.flush(); os.fsync(stream.fileno())
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=args.metadata.parent, prefix=".lola-preview-meta-", suffix=".tmp", delete=False) as stream:
            metadata_tmp = Path(stream.name)
            json.dump(metadata, stream, indent=2, allow_nan=False); stream.write("\n"); stream.flush(); os.fsync(stream.fileno())
        if args.output.exists() or args.metadata.exists():
            raise FileExistsError("Preview artifact appeared during generation; refusing to overwrite.")
        os.replace(output_tmp, args.output); output_tmp = None; promoted = True
        os.replace(metadata_tmp, args.metadata); metadata_tmp = None
    except Exception:
        if promoted and args.output.exists() and not args.metadata.exists():
            args.output.unlink()
        raise
    finally:
        for temporary in (output_tmp, metadata_tmp):
            if temporary and temporary.exists():
                temporary.unlink()
    print(json.dumps({"status": "preview_created", "byteSize": len(png), "sha256": metadata["output"]["sha256"], "finiteSampleCount": finite_count, "scientificallyValidated": False, "mapReady": False}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"LOLA preview generation failed: {type(exc).__name__}: {exc}", file=__import__("sys").stderr)
        raise SystemExit(1)
