# TODO

Pendientes planificados, sin un orden de prioridad fijo.

## Desafíos reales del dominio

- Implementar los **tipos de desafíos reales** planteados para nuestro dominio. Hoy el proyecto solo trae los demos de ejemplo ("hello world"-style) como placeholder del motor de ejecución.
- Agregar **ejemplos más realistas** para cada tipo de proyecto (TypeScript simple/multi-archivo, Java simple, Spring Boot) que se acerquen a los desafíos que se van a proponer.

## Tests

- Agregar **tests básicos de ejecución** cubriendo los cuatro flujos del motor frontend + servidor:
  - TypeScript (1 archivo, en navegador).
  - TypeScript multi-archivo (esbuild por API).
  - Java simple (javac/java por API).
  - Spring Boot (Maven, streams en vivo, Detener)
  - Casos borde: puerto ocupado, 409 con ejecución en curso, servidor caído, camino `files`/`entry`, validación de `path`.

## Unificación con el prototipo del 05/08

- **Idea**: unificar este proyecto junto con el prototipo mostrado en la **reunión del 05/08**, que demostraba el funcionamiento de Monaco imitando las funciones reales que debería tener. Nos gustó cómo estaba planteado y conviene consolidarlo en una sola herramienta que cubra el flujo real de trabajo (no solo demos sueltas).

## Alcance / aclaración

- Este proyecto está pensado para **probar las capacidades de Monaco**, no para ser usado tal cual en un servidor. No es performante: es un entorno de pruebas que puede ser reutilizado en algún momento.