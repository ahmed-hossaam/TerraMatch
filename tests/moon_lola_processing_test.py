"""Small synthetic unit tests; these values are not lunar observations."""
import importlib.util
import unittest
from pathlib import Path

import numpy as np

SCRIPT = Path(__file__).parents[1] / "scripts" / "moon" / "process-lola-height.py"
SPEC = importlib.util.spec_from_file_location("lola_height_processor", SCRIPT)
PROCESSOR = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(PROCESSOR)


class ProcessLolaSamplesTest(unittest.TestCase):
    def test_masks_only_declared_nodata_and_applies_scale_without_radius_offset(self):
        # Synthetic test fixture only; not source-derived lunar data.
        source = np.array([[-32768, -2], [0, 4]], dtype=np.int16)
        result, mask = PROCESSOR.process_samples(source, nodata_value=-32768, scale=0.5)
        self.assertEqual(result.shape, (2, 2))
        self.assertEqual(result.dtype, np.dtype("float32"))
        self.assertTrue(np.isnan(result[0, 0]))
        self.assertEqual(int(mask.sum()), 1)
        np.testing.assert_array_equal(result[~mask], np.array([-1, 0, 2], dtype=np.float32))

    def test_rejects_wrong_dimensions_type_or_nonfinite_scale(self):
        with self.assertRaises(TypeError):
            PROCESSOR.process_samples(np.array([1, 2], dtype=np.int16), nodata_value=-32768, scale=0.5)
        with self.assertRaises(TypeError):
            PROCESSOR.process_samples(np.array([[1.0]], dtype=np.float32), nodata_value=-32768, scale=0.5)
        with self.assertRaises(ValueError):
            PROCESSOR.process_samples(np.array([[1]], dtype=np.int16), nodata_value=-32768, scale=float("nan"))

    def test_aux_parser_requires_nodata_scale_offset_and_actual_range(self):
        # Synthetic XML metadata fixture, not an actual source product.
        import tempfile
        xml = "<PAMDataset><PAMRasterBand><NoDataValue>-32768</NoDataValue><Scale>0.5</Scale><Offset>0</Offset><Metadata><MDI key='actual_range'>{-10, 20}</MDI></Metadata></PAMRasterBand></PAMDataset>"
        with tempfile.TemporaryDirectory() as directory:
            aux = Path(directory) / "fixture.xml"
            aux.write_text(xml, encoding="utf-8")
            result = PROCESSOR.parse_aux(aux)
        self.assertEqual(result["noDataValue"], -32768)
        self.assertEqual(result["scale"], 0.5)
        self.assertEqual(result["offset"], 0.0)
        self.assertEqual(result["actualRange"], {"minimum": -10.0, "maximum": 20.0})


if __name__ == "__main__":
    unittest.main()
