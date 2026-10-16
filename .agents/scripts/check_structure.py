from pathlib import Path

root = Path(__file__).resolve().parents[2]
src = root / "backend" / "src"
for forbidden in ("domain", "application", "infrastructure", "presentation"):
    if (src / forbidden).exists():
        raise SystemExit(f"Capa global no permitida: backend/src/{forbidden}")

required = {"domain", "application", "infrastructure", "dto", "mappers", "api"}
for module in (src / "modules").iterdir():
    if module.is_dir() and not module.name.startswith("__") and not required.issubset({path.name for path in module.iterdir()}):
        raise SystemExit(f"Modulo incompleto: {module.name}")

print("Estructura modular valida.")
