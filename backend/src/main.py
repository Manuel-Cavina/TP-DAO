"""Punto de entrada ASGI: la inicialización vive en bootstrap/."""

from bootstrap.application_factory import Application_Factory

app = Application_Factory.crear_aplicacion()
