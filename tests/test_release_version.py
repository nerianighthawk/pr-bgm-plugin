import tempfile
import unittest
from pathlib import Path

from scripts.release_version import next_version


class ReleaseVersionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.manifest_path = Path(self.temp_dir.name) / "manifest.json"
        self.manifest_path.write_text('{"version":"0.1.0"}', encoding="utf-8")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_patch_uses_manifest_version_when_no_release_exists(self):
        self.assertEqual(next_version("[Patch] Fix search", "", self.manifest_path), "v0.1.1")

    def test_minor_and_major_reset_lower_components(self):
        self.assertEqual(next_version("[Minor] Add filters", "v2.4.7", self.manifest_path), "v2.5.0")
        self.assertEqual(next_version("[Major] Redesign", "v2.4.7", self.manifest_path), "v3.0.0")

    def test_rejects_unmarked_subject_and_invalid_release_tag(self):
        with self.assertRaises(ValueError):
            next_version("Patch: Fix search", "v0.1.0", self.manifest_path)
        with self.assertRaises(ValueError):
            next_version("[Patch] Fix search", "latest", self.manifest_path)


if __name__ == "__main__":
    unittest.main()
