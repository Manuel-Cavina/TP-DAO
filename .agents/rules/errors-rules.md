# Reglas de errores

- Una regla de negocio se expresa mediante una excepción en `modules/<modulo>/domain/exceptions/`.
- Toda excepción de negocio hereda de `errors.business_error.BusinessError`.
- Los errores técnicos no heredan de `BusinessError`; SQLite usa `Persistencia_Exception`.
- `api/` captura las excepciones y las convierte en mensajes claros. `domain/` no conoce HTTP.
- No capturar `Exception` en domain o application para ocultarlo; solo traducirlo en el borde técnico correspondiente.
- Reutilizar una excepción de otro módulo solo cuando representa exactamente la misma regla; de lo contrario declarar una local.
