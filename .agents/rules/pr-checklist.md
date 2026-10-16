# Checklist antes de PR

- [ ] Leí el spec aplicable, `docs/convenciones.md` y la sección del módulo.
- [ ] El cambio permanece dentro de los archivos autorizados para la tarea.
- [ ] El dominio no usa sesiones, consultas, HTTP ni UI.
- [ ] El service no conoce persistencia; el repository no controla la transacción.
- [ ] Los errores de negocio están en el módulo y heredan de `BusinessError`.
- [ ] La operación compuesta usa la sesión de la petición y conserva atomicidad.
- [ ] Se ejecutaron los checks de `.agents/settings.json` y las pruebas afectadas.
- [ ] Un cambio transversal tiene contrato de `architect`; API/ORM/pagos/datos tienen auditoría de seguridad.
