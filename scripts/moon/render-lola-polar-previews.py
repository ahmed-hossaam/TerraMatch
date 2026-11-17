#!/usr/bin/env python3
"""Render deterministic north/south spherical-stereographic research previews.

Nearest-neighbour display reprojection of the existing LDEM_4 relative-height
array only. Outputs are preview PNGs, not validated science rasters or GeoTIFFs.
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
SHAPE = (720, 1440)
RADIUS_M = 1_737_400.0
LOW_M, HIGH_M = -5320.5, 5681.0
ANCHORS = ((0.0, (24, 65, 92)), (0.5, (190, 190, 177)), (1.0, (178, 78, 46)))
LATITUDE_LIMIT = 50.0
DEFAULT_WIDTH = 700
DEFAULT_PIXEL_SIZE_M = 5000.0


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def color(value: float) -> tuple[int, int, int, int]:
    amount = min(1.0, max(0.0, (value - LOW_M) / (HIGH_M - LOW_M)))
    left, right = (ANCHORS[0], ANCHORS[1]) if amount <= 0.5 else (ANCHORS[1], ANCHORS[2])
    fraction = (amount - left[0]) / (right[0] - left[0])
    rgb = tuple(round(a + (b - a) * fraction) for a, b in zip(left[1], right[1]))
    return (*rgb, 255)


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def encode_png(rows: list[bytes], width: int, height: int) -> bytes:
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(b"".join(b"\x00" + row for row in rows), level=9)
    return b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header) + png_chunk(b"IDAT", compressed) + png_chunk(b"IEND", b"")


def forward(lon_deg: float, lat_deg: float, hemisphere: str) -> tuple[float, float]:
    lon, lat = math.radians(lon_deg), math.radians(lat_deg)
    rho = 2 * RADIUS_M * math.tan((math.pi / 2 - abs(lat)) / 2)
    if hemisphere == "north":
        return rho * math.sin(lon), -rho * math.cos(lon)
    return rho * math.sin(lon), rho * math.cos(lon)


def inverse(x: float, y: float, hemisphere: str) -> tuple[float, float]:
    rho = math.hypot(x, y)
    angular_distance = 2 * math.atan(rho / (2 * RADIUS_M))
    if hemisphere == "north":
        lat = math.pi / 2 - angular_distance
        lon = math.atan2(x, -y) if rho > 1e-9 else 0.0
    else:
        lat = -math.pi / 2 + angular_distance
        lon = math.atan2(x, y) if rho > 1e-9 else 0.0
    longitude = (math.degrees(lon) + 180.0) % 360.0 - 180.0
    return longitude, math.degrees(lat)


def source_index(lon: float, lat: float) -> tuple[int, int]:
    wrapped = (lon + 180.0) % 360.0 - 180.0
    column = min(1439, max(0, math.floor((wrapped + 180.0) * 4)))
    row = min(719, max(0, math.floor((90.0 - lat) * 4)))
    return row, column


def render(values, hemisphere: str, width: int, pixel_size_m: float) -> tuple[bytes, dict[str, int]]:
    half = width / 2.0
    rows: list[bytes] = []
    stats = {"insideProjectionDomain": 0, "finiteSourceSamples": 0, "nonFiniteSourceSamples": 0, "outsideProjectionDomain": 0}
    rho_limit = 2 * RADIUS_M * math.tan(math.radians((90 - LATITUDE_LIMIT) / 2))
    for row_index in range(width):
        row = bytearray()
        y = (half - row_index - 0.5) * pixel_size_m
        for column_index in range(width):
            x = (column_index + 0.5 - half) * pixel_size_m
            if math.hypot(x, y) > rho_limit:
                row.extend((0, 0, 0, 0))
                stats["outsideProjectionDomain"] += 1
                continue
            lon, lat = inverse(x, y, hemisphere)
            source_row, source_column = source_index(lon, lat)
            value = float(values[source_row, source_column])
            stats["insideProjectionDomain"] += 1
            if math.isfinite(value):
                row.extend(color(value))
                stats["finiteSourceSamples"] += 1
            else:
                row.extend((0, 0, 0, 0))
                stats["nonFiniteSourceSamples"] += 1
        rows.append(bytes(row))
    return encode_png(rows, width, width), stats


def write_pair(image_path: Path, metadata_path: Path, image: bytes, metadata: dict) -> None:
    if image_path.exists() or metadata_path.exists():
        raise FileExistsError(f"Refusing to overwrite existing polar artifact: {image_path.name}")
    image_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_image = tmp_metadata = None
    promoted_image = False
    try:
        with tempfile.NamedTemporaryFile("wb", dir=image_path.parent, prefix=".lola-polar-", suffix=".tmp", delete=False) as stream:
            tmp_image = Path(stream.name)
            stream.write(image); stream.flush(); os.fsync(stream.fileno())
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=metadata_path.parent, prefix=".lola-polar-meta-", suffix=".tmp", delete=False) as stream:
            tmp_metadata = Path(stream.name)
            json.dump(metadata, stream, indent=2, allow_nan=False); stream.write("\n"); stream.flush(); os.fsync(stream.fileno())
        if image_path.exists() or metadata_path.exists():
            raise FileExistsError("A polar preview appeared during generation; refusing to overwrite it.")
        os.replace(tmp_image, image_path); tmp_image = None; promoted_image = True
        os.replace(tmp_metadata, metadata_path); tmp_metadata = None
    except Exception:
        if promoted_image and image_path.exists() and not metadata_path.exists():
            image_path.unlink()
        raise
    finally:
        for temporary in (tmp_image, tmp_metadata):
            if temporary and temporary.exists():
                temporary.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("data/processed/moon/lola/ldem_4_height_m.npy"))
    parser.add_argument("--input-metadata", type=Path, default=Path("data/processed/moon/lola/ldem_4_height_m.json"))
    parser.add_argument("--output-directory", type=Path, default=Path("data/processed/moon/lola"))
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--pixel-size-m", type=float, default=DEFAULT_PIXEL_SIZE_M)
    args = parser.parse_args()
    if not 256 <= args.width <= 2048 or not math.isfinite(args.pixel_size_m) or args.pixel_size_m <= 0:
        raise ValueError("width must be 256–2048 pixels and pixel size must be finite and positive.")
    if sha256(args.input) != EXPECTED_NPY_SHA256:
        raise ValueError("Processed LOLA input checksum differs from the reviewed immutable source array.")
    with args.input_metadata.open(encoding="utf-8") as stream:
        input_metadata = json.load(stream)
    if input_metadata.get("output", {}).get("sha256", "").upper() != EXPECTED_NPY_SHA256:
        raise ValueError("Existing NPY sidecar does not identify the expected processed artifact.")
    import numpy as np

    values = np.load(args.input, mmap_mode="r", allow_pickle=False)
    if values.shape != SHAPE or values.dtype != np.dtype("float32"):
        raise ValueError("LOLA source must remain the 720x1440 Float32 relative-height array.")
    outputs = []
    for hemisphere in ("north", "south"):
        image, counts = render(values, hemisphere, args.width, args.pixel_size_m)
        image_path = args.output_directory / f"ldem_4_{hemisphere}-polar-preview.png"
        metadata_path = args.output_directory / f"ldem_4_{hemisphere}-polar-preview.json"
        rho_limit = 2 * RADIUS_M * math.tan(math.radians((90 - LATITUDE_LIMIT) / 2))
        metadata = {
            "schemaVersion": "1.0.0",
            "artifactId": f"moon-lola-ldem-4-{hemisphere}-polar-display-preview-v1",
            "kind": "unvalidated_research_display_preview",
            "input": {"productId": "LDEM_4", "version": "V3.0", "path": "data/processed/moon/lola/ldem_4_height_m.npy", "sha256": EXPECTED_NPY_SHA256, "shapeLinesSamples": list(SHAPE), "dtype": "float32", "units": "m relative surface height"},
            "output": {"path": image_path.as_posix(), "format": "PNG RGBA 8-bit", "width": args.width, "height": args.width, "pixelSizeM": args.pixel_size_m, "byteSize": len(image), "sha256": hashlib.sha256(image).hexdigest().upper()},
            "projection": {"name": "spherical polar stereographic display", "hemisphere": hemisphere, "targetBody": "Moon", "referenceFrame": "MEAN EARTH/POLAR AXIS OF DE421", "latitudeType": "planetocentric", "longitudeDirection": "positive east", "longitudeOriginDegrees": 0, "referenceSphereRadiusM": RADIUS_M, "trueScaleAtPole": True, "angularDomain": "longitude [-180, 180), latitude >= 50 degrees north" if hemisphere == "north" else "longitude [-180, 180), latitude <= -50 degrees south", "cutoffLatitudeDegrees": LATITUDE_LIMIT, "projectedCutoffRadiusM": rho_limit, "forwardEquations": {"rho": "2R*tan((90-|latitude|)/2)", "x": "rho*sin(longitude)", "yNorth": "-rho*cos(longitude)", "ySouth": "rho*cos(longitude)"}, "inverseEquations": {"angularDistance": "2*atan(hypot(x,y)/(2R))", "latitudeNorth": "90-angularDistance", "latitudeSouth": "-90+angularDistance", "longitudeNorth": "atan2(x,-y)", "longitudeSouth": "atan2(x,y)"}, "rasterPixelRegistration": "pixel centers are sampled at ((column+0.5-width/2)*pixelSize, (height/2-row-0.5)*pixelSize)", "coordinateToSourceGrid": "inverse project then nearest containing source cell using Phase 10 LDEM_4 pixel-center mapping; no bilinear interpolation"},
            "display": {"variable": "relative surface height", "units": "m", "rangeM": [LOW_M, HIGH_M], "rangeMethod": "LDEM_4 1st–99th percentile display range; color clipping only", "sampling": "nearest source cell; display reprojection only", "transparentOutsideProjectionDomainPixels": counts["outsideProjectionDomain"], "finiteSourceSamplePixels": counts["finiteSourceSamples"], "nonFiniteSourceSamplePixels": counts["nonFiniteSourceSamples"], "sourceValuesModified": False},
            "scientificStatus": {"independentPointValidation": False, "scientificallyValidated": False, "validatedLayer": False, "previewOnly": True, "mapReady": False},
            "provenance": {"sourceDataset": "LRO-L-LOLA-4-GDR-V1.0", "sourceProduct": "LDEM_4 V3.0", "sourceUrl": input_metadata["sources"]["jp2"]["officialUrl"], "renderingScript": "scripts/moon/render-lola-polar-previews.py", "processing": "Reproject each target pixel center to a Moon latitude/longitude and sample the checksum-verified relative-height array by nearest containing source cell; no alteration of source values."},
            "limitations": ["This projected PNG is a visual derivative, not a GeoTIFF or independently validated science product.", "The underlying GDR is binned/interpolated and the valid observation footprint has not been computed.", "Only the latitude cap >= 50° north or <= 50° south is represented; outside-cap pixels are transparent.", "The 5 km output pixel spacing is a display sampling choice and does not increase source resolution.", "NoData source values remain transparent; transparent pixels outside the polar cap are projection-domain exclusions, not NoData."],
        }
        write_pair(image_path, metadata_path, image, metadata)
        outputs.append({"hemisphere": hemisphere, "path": image_path.as_posix(), "bytes": len(image), "sha256": metadata["output"]["sha256"], **counts})
    print(json.dumps({"status": "polar_previews_created", "inputSha256": EXPECTED_NPY_SHA256, "outputs": outputs, "scientificallyValidated": False, "mapReady": False}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"LOLA polar preview generation failed: {type(exc).__name__}: {exc}", file=__import__("sys").stderr)
        raise SystemExit(1)
