"""Chequeos estáticos mínimos de las convenciones del TP."""

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULES = ROOT / "backend" / "src" / "modules"
FORBIDDEN_DOMAIN_IMPORTS = {"sqlite3", "fastapi", "flask", "django", "requests"}


def imported_roots(tree: ast.AST) -> set[str]:
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        if isinstance(node, ast.ImportFrom) and node.module:
            roots.add(node.module.split(".")[0])
    return roots


def validate_domain_imports() -> list[str]:
    failures: list[str] = []
    for path in MODULES.glob("*/domain/**/*.py"):
        roots = imported_roots(ast.parse(path.read_text(encoding="utf-8")))
        forbidden = roots & FORBIDDEN_DOMAIN_IMPORTS
        if forbidden:
            failures.append(f"{path.relative_to(ROOT)} importa {', '.join(sorted(forbidden))}")
    return failures


def validate_business_exceptions() -> list[str]:
    failures: list[str] = []
    for path in MODULES.glob("*/domain/exceptions/*.py"):
        if path.name == "__init__.py":
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name.endswith("_Exception"):
                bases = {base.id for base in node.bases if isinstance(base, ast.Name)}
                if "BusinessError" not in bases:
                    failures.append(f"{path.relative_to(ROOT)}: {node.name} no hereda BusinessError")
    return failures


failures = validate_domain_imports() + validate_business_exceptions()
if failures:
    raise SystemExit("\n".join(failures))

print("Convenciones verificadas.")
