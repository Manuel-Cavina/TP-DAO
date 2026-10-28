"""Descubrimiento de pruebas modulares para unittest y pytest."""

import importlib.util
from pathlib import Path
from pkgutil import extend_path
import sys
import unittest

_TESTS_MODULES_DIR = Path(__file__).resolve().parent
_SRC_DIR = str(_TESTS_MODULES_DIR.parents[1] / "src")
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

__path__ = [str(_TESTS_MODULES_DIR)]


def load_tests(
    loader: unittest.TestLoader,
    standard_tests: unittest.TestSuite,
    pattern: str,
) -> unittest.TestSuite:
    for test_file in sorted(_TESTS_MODULES_DIR.rglob(pattern or "test*.py")):
        rel_parts = test_file.relative_to(_TESTS_MODULES_DIR).with_suffix("").parts
        module_name = "tests_modules." + ".".join(rel_parts)
        spec = importlib.util.spec_from_file_location(module_name, test_file)
        if spec is not None and spec.loader is not None:
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            standard_tests.addTests(loader.loadTestsFromModule(module))
    return standard_tests
