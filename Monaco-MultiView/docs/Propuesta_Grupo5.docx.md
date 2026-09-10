**Grupo 5 — Motor de Desafíos Prácticos**

*Documento de trabajo · Pre-Sprint 0*

Este documento presenta las épicas identificadas para el microservicio del Grupo 5, responsable de gestionar los desafíos prácticos de programación de la plataforma. Cada épica describe un bloque grande de funcionalidad (objetivo y alcance), acompañada de consideraciones técnicas y de una primera propuesta de Historias de Usuario. Las épicas están ordenadas por prioridad de construcción. Al final se incluye la Definition of Done (DoD) acordada por el equipo.

*Nota: al tratarse de una primera versión, las épicas e historias no son definitivas y serán refinadas y cargadas en TAIGA. Varias integraciones dependen de contratos aún en negociación con otros grupos y del API Gateway, actualmente a cargo de otro equipo y no disponible.*

**G05-E01  Gestión de Contenido de Desafíos Prácticos     \[Prioridad: Must\]**

**OBJETIVO**

Permitir a los profesores almacenar el contenido técnico de un desafío práctico —código inicial, casos de prueba y solución esperada— vinculándolo al identificador central del desafío, para proveer el material que el motor utilizará luego para evaluar las entregas de los alumnos.

**SUPOSICIONES Y RESTRICCIONES**

* **Suposiciones:** El Frontend orquesta la creación, separando la metadata general (Grupo 3\) del contenido técnico específico (Grupo 5).

* **Restricciones (legales/técnicas):** La base de datos es de uso exclusivo del microservicio y no comparte esquema con otros equipos. Todo registro implementa borrado lógico (soft delete) para conservar la producción académica por 5 años.

**CRITERIOS DE ACEPTACIÓN A NIVEL ÉPICO**

* El conjunto mínimo de historias permite guardar el contenido práctico vinculado a un desafío y a una cohorte válida.

* KPIs iniciales: la totalidad de los desafíos creados conserva la integridad de su configuración persistida.

* Sin regresiones críticas en la orquestación de creación desde el Frontend.

* Observabilidad y alertas configuradas (logs, métricas, traces).

* Documentación de uso y operación publicada.

**DEPENDENCIAS / IMPACTOS**

* **Servicios / APIs:** API Gateway (enrutamiento).

* **Módulos afectados:** Base de datos relacional interna del Grupo 5\.

* **Otros equipos:** Grupo 3 (provisión del identificador del desafío).

* **Impacto en datos / migraciones:** Creación del esquema base con soporte para datos estructurados (JSON).

* **Feature toggles / flags:** No.

**HISTORIAS DE USUARIO**

**G05-E01-US01 — Guardado de configuración y contenido de Desafío Práctico**

**DESCRIPCIÓN (COMO / QUIERO / PARA)**

**Como:** Profesor

**Quiero:** almacenar el código inicial, los casos de prueba ocultos y la solución esperada de un desafío, vinculándolos al identificador central

**Para:** proveer el material técnico que el motor usará para compilar y evaluar las entregas de los alumnos

**NOTAS / OBSERVACIONES**

* **Reglas de negocio:** El Grupo 5 es dueño del contenido; no almacena reglas de experiencia (XP), monedas ni fechas de vencimiento (pertenecen al Grupo 3).

* **Validaciones:** El payload debe contener obligatoriamente el identificador del desafío y el de la cohorte.

* **Datos obligatorios:** Desafio\_ID, Curso\_Cohorte\_ID, Subtipo\_Practico, Configuración (código base y casos de prueba).

* **Performance:** Tiempos de guardado por debajo de los 2 segundos.

* **Seguridad:** Validación de token JWT vía API Gateway para verificar rol PROFESOR.

* **Accesibilidad:** N/A (endpoint backend).

* **Otros:** Ningún registro recibe borrado físico (soft delete obligatorio).

**CRITERIOS DE ACEPTACIÓN (CA)**

* **CA1:** Si el payload es válido, el sistema persiste la configuración asociada al desafío.

* **CA2:** Si falta el contexto de cohorte, la API rechaza la petición con un error de solicitud (HTTP 400).

* **CA3:** Al eliminar o actualizar un desafío, el registro anterior se marca con baja lógica, conservando el historial.

**BDD (ESCENARIOS)**

**Característica:** Persistencia del contenido específico de desafíos prácticos.

**Escenario 1**

**Dado:** Un profesor autenticado que completó la creación base en el Grupo 3\.

**Cuando:** Envía la creación del desafío práctico con identificador válido, código base y casos de prueba.

**Entonces:** El microservicio guarda el registro y responde con creación exitosa (HTTP 201).

**Escenario 2**

**Dado:** Un payload de creación de desafío práctico.

**Cuando:** El sistema detecta que falta el identificador de cohorte.

**Entonces:** Cancela la operación y devuelve un error de solicitud (HTTP 400\) indicando el dato faltante.

**Escenario 3**

**Dado:** Un desafío práctico ya existente.

**Cuando:** El profesor solicita eliminarlo.

**Entonces:** El sistema lo marca con baja lógica y responde sin contenido (HTTP 204), conservando el registro.

**PROTOTIPO**

* **Capturas:** N/A (endpoint backend, sin UI directa).

* **URL Figma:** N/A.

* **Storybook:** N/A.

* **Mock API / Swagger:** POST /api/desafios-practicos (pendiente de definición final).

**ESTIMACIÓN / PRIORIDAD**

* **Puntos (Fibonacci):** 

* **Prioridad (MoSCoW):** Must

**DEPENDENCIAS / IMPACTOS**

* **Servicios involucrados:** API Gateway, Motor de Desafíos (G3).

* **Módulos afectados:** Controlador y Repositorio de Desafíos Prácticos.

* **Otros equipos / aprobaciones:** El Frontend debe orquestar la llamada tras obtener el identificador del Grupo 3\.

* **Impacto en datos / migraciones:** Creación de tabla con soporte para datos estructurados (JSON).

* **Riesgos y mitigación:** Desincronización entre G3 y G5 si falla la API. Mitigación: reintentos o rollback compensatorio desde el Frontend.

**G05-E01-US02 — Modificar o dar de baja un desafío práctico**

**DESCRIPCIÓN (COMO / QUIERO / PARA)**

**Como:** profesor.

**Quiero:** modificar o dar de baja un desafío existente sin perder las versiones anteriores.

**Para:** conservar el historial de la producción académica.

**NOTAS / OBSERVACIONES**

* **Reglas de negocio:** al modificar, se conserva la versión anterior y se crea una nueva vigente. La baja es lógica, sin eliminar el historial.

* **Validaciones:** el desafío debe existir, estar activo y conservar sus campos obligatorios.

* **Datos obligatorios:** identificador del desafío y datos modificados. El sistema registra usuario y fecha de la operación.

* **Performance:** los listados activos deben excluir los desafíos dados de baja desde el backend.

* **Seguridad:** únicamente profesores autorizados pueden realizar estas operaciones.

* **Accesibilidad:** formulario y confirmación de baja utilizables mediante teclado, con mensajes claros.

* **Otros:** las entregas anteriores mantienen su vínculo con la versión utilizada.

**CRITERIOS DE ACEPTACIÓN (CA)**

* **CA1:** al modificar un desafío, se crea una nueva versión vigente y se conserva la anterior sin alterar las entregas asociadas.

* **CA2:** al dar de baja un desafío, deja de aparecer en los listados activos, pero permanece almacenado con su historial.

* **CA3:** si el profesor no está autorizado o los datos son inválidos, la operación se rechaza sin modificar registros.

**BDD (ESCENARIOS)**

**Característica:** Modificación y baja lógica de desafíos prácticos.

**Escenario 1 — Modificar un desafío**

**Dado:** un desafío activo y un profesor autorizado.

**Cuando:** el profesor guarda cambios válidos.

**Entonces:** se crea una nueva versión vigente y se conserva la anterior.

**Escenario 2 — Dar de baja un desafío**

**Dado:** un desafío activo y un profesor autorizado.

**Cuando:** el profesor confirma la baja.

**Entonces:** el desafío desaparece de los listados activos, conservando su historial.

**Escenario 3 — Operación sin autorización**

**Dado:** un profesor sin permisos sobre el desafío.

**Cuando:** intenta modificarlo o darlo de baja.

**Entonces:** el sistema rechaza la operación y los datos permanecen intactos.

**PROTOTIPO**

* **Capturas:** Pendientes.

* **URL Figma:** Pendiente.

* **Storybook:** No definido.

* **Mock API / Swagger:** 

* PUT /api/practical-challenges/{id}

* DELETE /api/practical-challenges/{id} (baja lógica).

**ESTIMACIÓN / PRIORIDAD**

* **Puntos (Fibonacci):** A estimar por el equipo.

* **Prioridad (MoSCoW):** Must.

**DEPENDENCIAS / IMPACTOS**

* **Servicios involucrados:** Desafíos Prácticos, Motor de Desafíos e Identidad/Autorización.

* **Módulos afectados:** administración, versionado y listados.

* **Otros equipos / aprobaciones:** acordar con Tema 03 cómo se sincronizan versiones y bajas.

* **Impacto en datos / migraciones:** incorporar versionado y campos de baja lógica, preservando las referencias históricas.

* **Riesgo y mitigación:** evitar alterar entregas anteriores mediante referencias a versiones inmutables.

**G05-E02  Orquestación de Ejecución Aislada (Sandbox)     \[Prioridad: Must\]**

**OBJETIVO**

Enviar el código del alumno junto con los casos de prueba del profesor a un entorno de ejecución aislado y traducir la salida técnica en feedback formativo, para que el alumno pueda validar su solución y comprender sus errores.

**ALCANCE**

* Ensamblar el código del alumno con los casos de prueba y solicitar su ejecución al entorno aislado.

* Capturar el resultado de la ejecución (salida, estado, tiempo y memoria consumidos).

* Traducir el resultado técnico en un veredicto (superado / fallado) y un mensaje de feedback claro.

* No exponer al alumno el contenido de los casos de prueba ocultos del profesor.

**CONSIDERACIONES TÉCNICAS Y DEPENDENCIAS**

* La ejecución la provee el Grupo 8 (Sandbox); la comunicación es sincrónica y pasa por el API Gateway.

* El tiempo de espera del cliente debe contemplar el límite de ejecución para no cortar la conexión.

* La ejecución es efímera: no genera persistencia de datos.

**HISTORIAS DE USUARIO**

**G05-E02-US01 — Preparar y ejecutar código en el Sandbox**

**DESCRIPCIÓN (COMO / QUIERO / PARA)**

**Como:** sistema (Motor de Desafíos).

**Quiero:** solicitar el ensamblado del código del alumno con los casos de prueba y su envío al entorno aislado.

**Para:** obtener la salida de la ejecución y las métricas de consumo de recursos.

**NOTAS / OBSERVACIONES**

* **Reglas de negocio:** Desafíos Prácticos prepara la solicitud; el Sandbox ejecuta el código de forma aislada.

* **Validaciones:** deben existir código y casos de prueba correspondientes a la versión evaluada.

* **Datos obligatorios:** identificador de la solicitud, código, lenguaje y casos de prueba.

* **Performance:** la comunicación debe tener un tiempo máximo de espera configurable.

* **Seguridad:** el código se ejecuta exclusivamente en el Sandbox. Las llamadas entre servicios pasan por el API Gateway.

* **Accesibilidad:** no aplica directamente; funcionalidad de backend.

* **Otros:** una falla de infraestructura no debe interpretarse como una solución incorrecta del alumno.

**CRITERIOS DE ACEPTACIÓN (CA)**

* **CA1:** si falta el código o no existen casos de prueba, se rechaza la solicitud sin invocar al Sandbox.

* **CA2:** ante una respuesta válida del Sandbox, se registran salida, error, estado, tiempo y memoria, asociados a la solicitud.

* **CA3:** si el Sandbox no responde dentro del tiempo configurado, se registra un fallo de infraestructura y se informa al solicitante sin esperar indefinidamente ni impedir otras operaciones.

**BDD (ESCENARIOS)**

**Característica:** Ejecución aislada del código del alumno.

**Escenario 1 — Ejecución con respuesta**

**Dado:** una solicitud con código y casos de prueba válidos.

**Cuando:** se envía al Sandbox y este responde.

**Entonces:** se capturan y registran salida, error, estado, tiempo y memoria.

**Escenario 2 — Datos incompletos**

**Dado:** una solicitud sin código o sin casos de prueba.

**Cuando:** el sistema valida los datos.

**Entonces:** rechaza la solicitud indicando la información faltante y no invoca al Sandbox.

**Escenario 3 — Sandbox sin respuesta**

**Dado:** una solicitud válida enviada al Sandbox.

**Cuando:** se supera el tiempo máximo de espera sin respuesta.

**Entonces:** se registra el fallo técnico, se informa al solicitante y la plataforma continúa atendiendo otras operaciones.

**PROTOTIPO**

* **Capturas:** no aplica; funcionalidad de backend.

* **URL Figma:** no aplica.

* **Storybook:** no aplica.

* **Mock API / Swagger — propuesta:** POST /api/practical-challenges/{id}/executions. Respuesta simulada del Sandbox con salida, error, estado, tiempo y memoria.

**ESTIMACIÓN / PRIORIDAD**

* **Puntos (Fibonacci):** a estimar por el equipo.

* **Prioridad:** Must.

**DEPENDENCIAS / IMPACTOS**

* **Servicios involucrados:** Motor de Desafíos, Desafíos Prácticos, Sandbox y API Gateway.

* **Módulos afectados:** preparación de ejecuciones, integración con Sandbox y registro de resultados.

* **Otros equipos / aprobaciones:** acordar con Tema 03 y Tema 06 el formato de solicitudes, respuestas, estados y unidades de las métricas.

* **Impacto en datos / migraciones:** almacenar el identificador de ejecución, su resultado, métricas y posibles fallos técnicos.

* **Riesgo y mitigación:** indisponibilidad del Sandbox; controlar el tiempo de espera y distinguir errores técnicos de fallos del código.

**G05-E02-US02 — Interpretar resultados y generar feedback**

**DESCRIPCIÓN (COMO / QUIERO / PARA)**

**Como:** sistema (Motor de Desafíos).

**Quiero:** obtener un veredicto y un feedback claro a partir de la salida técnica del Sandbox.

**Para:** que el alumno entienda si resolvió el problema y en qué se equivocó.

**NOTAS / OBSERVACIONES**

* **Reglas de negocio:** si supera todos los casos de prueba, el veredicto es Superado. Si falla un test, la compilación o el límite de ejecución, es Fallado.

* **Validaciones:** la respuesta debe corresponder a la ejecución solicitada y contener información suficiente para determinar el resultado.

* **Datos obligatorios:** identificador de ejecución, estado técnico y resultados de las pruebas o error correspondiente.

* **Performance:** la interpretación no debe requerir ejecutar nuevamente el código.

* **Seguridad:** el feedback no debe revelar código de los tests, soluciones de referencia ni entradas y resultados esperados privados

* **Accesibilidad:** mensajes claros y comprensibles, sin depender únicamente de colores para indicar el resultado.

* **Otros:** una falla de infraestructura no genera un veredicto Fallado; se informa como error técnico.

**CRITERIOS DE ACEPTACIÓN (CA)**

* **CA1:** si la ejecución finaliza correctamente y supera todos los casos de prueba, se devuelve el veredicto Superado.

* **CA2:** si falla algún test, la compilación o el límite de tiempo de ejecución, se devuelve Fallado con un mensaje que identifica el tipo de error.

* **CA3:** el feedback no expone código ni datos privados de los casos de prueba del profesor.

* **CA4:** si existe un error de infraestructura o la respuesta es incompleta, no se emite un veredicto académico y se informa el problema técnico.

**BDD (ESCENARIOS)**

**Característica:** Interpretación del resultado técnico y generación de feedback seguro.

**Escenario 1 — Todos los tests aprobados**

**Dado:** una ejecución completa que supera todos los casos de prueba.

**Cuando:** el sistema interpreta la respuesta del Sandbox.

**Entonces:** devuelve Superado y un mensaje que confirma que la solución pasó las pruebas.

**Escenario 2 — Error de compilación o tiempo**

**Dado:** una ejecución con error de compilación o que excedió el límite de tiempo del código.

**Cuando:** el sistema interpreta el resultado.

**Entonces:** devuelve Fallado e indica el tipo de error correspondiente.

**Escenario 3 — Fallo en un test privado**

**Dado:** una ejecución que falla un caso de prueba privado.

**Cuando:** el sistema genera el feedback.

**Entonces:** devuelve Fallado e informa el fallo sin revelar el código, las entradas ni los resultados esperados del test privado.

**Escenario 4 — Error de infraestructura**

**Dado:** una respuesta que indica una falla interna del Sandbox.

**Cuando:** el sistema interpreta la respuesta.

**Entonces:** informa un error técnico sin marcar la solución como Fallado.

**PROTOTIPO**

* **Capturas:** pendientes; mensajes de resultado y feedback.

* **URL Figma:** pendiente.

* **Storybook:** no definido.

* **Mock API / Swagger:** propuesta: respuesta con identificador de ejecución, veredicto y feedback. Ejemplos de resultado superado, fallo de test, compilación, tiempo y error técnico.

**ESTIMACIÓN / PRIORIDAD**

* **Puntos (Fibonacci):** a estimar por el equipo.

* **Prioridad (MoSCoW):** Must.

**DEPENDENCIAS / IMPACTOS**

* **Servicios involucrados:** Desafíos Prácticos, Motor de Desafíos y Sandbox.

* **Módulos afectados:** interpretación de resultados y generación de feedback.

* **Otros equipos / aprobaciones:** acordar con Tema 03 y Tema 06 los estados técnicos y su correspondencia con los veredicto.

* **Impacto en datos / migraciones:** registrar el veredicto y el feedback asociados a la ejecución.

* **Riesgo y mitigación:** los errores del Sandbox pueden contener información privada; filtrar y normalizar los mensajes antes de mostrarlos al alumno.

**G05-E03  Asistencia con IA y Salvaguardas     \[Prioridad: Must\]**

**OBJETIVO**

Aplicar las reglas del asistente de IA según la dificultad del desafío, evitando que el asistente revele la solución, y registrar el uso de la IA para su posterior evaluación, para ofrecer una ayuda proporcional al nivel del ejercicio sin comprometer su valor pedagógico.

**ALCANCE**

* Modular la ayuda del asistente según la dificultad del desafío.

* Interceptar y regenerar respuestas del asistente que se aproximen demasiado a la solución.

* Registrar la conversación del alumno con el asistente para su evaluación posterior.

**CONSIDERACIONES TÉCNICAS Y DEPENDENCIAS**

* El flujo de chat pasa por el microservicio del Grupo 5 antes de llegar al frontend (patrón intermediario / BFF).

* La respuesta se bloquea y regenera si supera el umbral de similitud con la solución real.

* Depende del servicio de Tutor de IA (LLM) y del Evaluador LLM (Grupo 7).

**HISTORIAS DE USUARIO**

**G05-E03-US01 — Regular la asistencia según la dificultad**

**DESCRIPCIÓN (COMO / QUIERO / PARA)**

**Como:** alumno.

**Quiero:** recibir ayuda del asistente acorde a la dificultad del desafío.

**Para:** contar con más o menos orientación según el nivel del ejercicio.

**NOTAS / OBSERVACIONES**

* **Reglas de negocio:** la asistencia disponible depende de la dificultad. En desafíos de máxima dificultad, no se brinda ayuda.

* **Validaciones:** comprobar la dificultad del desafío y que el alumno esté autorizado para acceder.

* **Datos obligatorios:** identificador del desafío, dificultad y consulta del alumno. La dificultad se obtiene del backend.

* **Performance:** verificar si la asistencia está habilitada antes de invocar al asistente.

* **Seguridad:** el alumno no puede modificar la dificultad ni eludir las restricciones desde el frontend.

* **Accesibilidad:** informar con texto claro cuándo la asistencia no está disponible y por qué.

* **Otros:** acordar los límites de ayuda para cada dificultad. Esta regla requiere validación con el docente o Product Owner: el PRD distingue la asistencia por riesgo de fuga de solución, que no equivale necesariamente a dificultad.

**CRITERIOS DE ACEPTACIÓN (CA)**

* **CA1:** la asistencia aplica los límites configurados para la dificultad del desafío.

* **CA2:** en desafíos de máxima dificultad, la solicitud se rechaza sin invocar al asistente y se informa al alumno que la ayuda está deshabilitada.

* **CA3:** la restricción se aplica desde el backend, incluso si el alumno intenta solicitar asistencia directamente mediante la API.

**BDD (ESCENARIOS)**

**Característica:** Control de asistencia según la dificultad del desafío.

**Escenario 1 — Asistencia habilitada**

**Dado:** un alumno autorizado y un desafío cuya dificultad permite asistencia.

**Cuando:** el alumno solicita ayuda.

**Entonces:** recibe orientación dentro de los límites configurados para ese nivel.

**Escenario 2 — Máxima dificultad**

**Dado:** un desafío de máxima dificultad.

**Cuando:** el alumno solicita ayuda.

**Entonces:** no se invoca al asistente y se informa que la asistencia está deshabilitada para ese nivel.

**Escenario 3 — Intento de eludir la restricción**

**Dado:** un desafío de máxima dificultad con asistencia deshabilitada.

**Cuando:** el alumno envía directamente una solicitud a la API indicando una dificultad menor.

**Entonces:** el sistema utiliza la dificultad registrada en el backend y rechaza la asistencia.

**PROTOTIPO**

* **Capturas:** pendientes; asistente habilitado y mensaje de asistencia deshabilitada.

* **URL Figma:** pendiente.

* **Storybook:** no definido.

* **Mock API / Swagger — propuesta:** Solicitud de ayuda con identificador del desafío y consulta. Respuestas de asistencia permitida y asistencia deshabilitada.

**ESTIMACIÓN / PRIORIDAD**

* **Puntos (Fibonacci):** a estimar por el equipo.

* **Prioridad:** Must, sujeto a validación de la regla funcional.

**DEPENDENCIAS / IMPACTOS**

* **Servicios involucrados:** Desafíos Prácticos, Motor de Desafíos y servicio responsable del tutor de IA.

* **Módulos afectados:** asistencia, consulta de dificultad y control de acceso.

* **Otros equipos / aprobaciones:** confirmar con el docente o Product Owner los límites por dificultad y con los equipos involucrados dónde se aplica la restricción.

* **Impacto en datos / migraciones:** incorporar la configuración de asistencia por dificultad si no existe.

* **Riesgo y mitigación:** aplicar límites inconsistentes; mantener una configuración común y validarla en el backend antes de solicitar ayuda.

### **G05-E03-US02 — Restricción del prompt del Tutor de IA según el nivel del desafío**

**Descripción (Como / Quiero / Para)**  
 **Como:** Motor de Desafíos Prácticos (Sistema)  
 **Quiero:** interceptar las respuestas del Tutor de IA que revelen la solución y ajustar la asistencia según el nivel del desafío  
 **Para:** evitar fugas de la solución en los desafíos de mayor exigencia

**Notas / Observaciones**

* **Reglas de negocio:** el nivel de asistencia depende del riesgo/nivel del desafío; en los de máxima exigencia, el asistente no debe aportar contenido que resuelva el ejercicio.  
* **Validaciones:** cada respuesta generada por el Tutor se evalúa antes de reenviarse al alumno.  
* **Datos obligatorios:** mensaje del alumno, respuesta candidata del Tutor, nivel del desafío, solución esperada.  
* **Performance:** la intercepción no debe degradar de forma perceptible la latencia del chat.  
* **Seguridad:** la solución esperada nunca se expone al cliente; el filtrado ocurre del lado del servidor.  
* **Accesibilidad:** N/A (lógica backend de intercepción).  
* **Otros:** la transcripción completa se conserva para el Evaluador LLM.

**Criterios de Aceptación (CA)**

* **CA1:** si la respuesta del Tutor supera el umbral de similitud con la solución esperada, se bloquea y se solicita una regeneración antes de mostrarla.  
* **CA2:** la transcripción del chat queda registrada y vinculada a la entrega.  
* **CA3:** el grado de asistencia entregado se corresponde con el nivel configurado del desafío.

**BDD (escenarios)**  
 **Característica:** Salvaguarda anti-fuga del Tutor de IA.

*Escenario 1*  
 **Dado:** un alumno en un desafío de alto nivel consulta al Tutor.  
 **Cuando:** la respuesta candidata resulta muy similar a la solución esperada.  
 **Entonces:** el sistema la bloquea y solicita una respuesta alternativa antes de reenviarla.

*Escenario 2*  
 **Dado:** un alumno en un desafío de nivel básico consulta al Tutor.  
 **Cuando:** la respuesta orienta sin revelar la solución.  
 **Entonces:** el sistema la entrega al alumno y registra el intercambio.

*Escenario 3*  
 **Dado:** un intercambio con el Tutor ya resuelto.  
 **Cuando:** finaliza la conversación.  
 **Entonces:** la transcripción queda almacenada y vinculada a la entrega para su evaluación posterior.

**Prototipo**

* **Capturas:** Pendiente (interfaz de chat del Frontend).  
* **URL Figma:** Pendiente.  
* **Storybook:** N/A.  
* **Mock API / Swagger:** flujo de chat intermediado por el G5 (pendiente de definición).

**Estimación / Prioridad**

* **Puntos (Fibonacci):**   
* **Prioridad (MoSCoW):** Must

**Dependencias / Impactos**

* **Servicios involucrados:** Tutor LLM, Evaluador LLM (G7).  
* **Módulos afectados:** módulo de intercepción de chat.  
* **Otros equipos / aprobaciones:** depende del contrato con el Tutor LLM y el Grupo 7\.  
* **Impacto en datos / migraciones:** persistencia de transcripciones vinculadas a la entrega.  
* **Riesgos y mitigación:** falsos positivos que bloqueen respuestas útiles. Mitigación: calibrar el umbral de similitud.  
* 

**G05-E04 — Veredicto Homogéneo y Resiliencia de Entregas**

**OBJETIVO**

Consolidar la nota técnica y el score de IA en un resultado estandarizado para el Motor Central, asegurando que el alumno pueda entregar incluso si los servicios de IA fallan.

**SUPOSICIONES Y RESTRICCIONES**

* **Suposiciones:** El Grupo 3 posee un endpoint único para recibir resultados, sea cual sea su origen.

* **Restricciones (legales/técnicas):** La caída de una dependencia externa nunca bloquea al alumno; si el Evaluador LLM no responde, se envía la nota técnica y el score de IA queda como cálculo diferido.

**CRITERIOS DE ACEPTACIÓN A NIVEL ÉPICO**

* El conjunto mínimo de historias permite enviar el resultado homogéneo al G3, gestionando la cola de evaluaciones diferidas si el G7 cae.

* KPIs iniciales: la totalidad de las entregas se procesa técnicamente incluso con el G7 indisponible.

* Sin regresiones críticas en la comunicación con el Grupo 3\.

* Observabilidad y alertas configuradas (logs, métricas, traces).

* Documentación de uso y operación publicada.

**DEPENDENCIAS / IMPACTOS**

* **Servicios / APIs:** Envío de resultados al Grupo 3\.

* **Módulos afectados:** Consolidador de notas y gestor de colas/reintentos.

* **Otros equipos:** Grupo 3 (Motor de Desafíos), Grupo 7 (Evaluador LLM).

* **Impacto en datos / migraciones:** Tabla de estados para la cola de cálculos diferidos.

* **Feature toggles / flags:** No.

**G05-E04-US01 — Evaluación asincrónica de uso de IA con tolerancia a fallos**

**DESCRIPCIÓN (COMO / QUIERO / PARA)**

**Como:** Motor de Desafíos Prácticos (Sistema)

**Quiero:** enviar la transcripción del chat al Evaluador LLM de forma asincrónica, con tolerancia a caídas

**Para:** puntuar el uso de la IA sin que la disponibilidad de ese servicio demore el veredicto técnico del alumno

**NOTAS / OBSERVACIONES**

* **Reglas de negocio:** El score de IA es un dato anexo; el desafío puede finalizarse técnicamente y notificarse al G3 sin ese valor.

* **Validaciones:** Si el alumno no usó el chat, se omite el envío y se asume un valor neutro.

* **Datos obligatorios:** Transcripción del chat, identificador del desafío, identificador del alumno.

* **Performance:** El procesamiento asincrónico no afecta el tiempo de respuesta de la entrega.

* **Seguridad:** N/A.

* **Accesibilidad:** N/A (procesos backend en segundo plano).

* **Otros:** Se requiere un worker para la cola y un endpoint para forzar reprocesamiento.

**CRITERIOS DE ACEPTACIÓN (CA)**

* **CA1:** Al procesar la entrega, se despacha el veredicto técnico al G3 (score de IA pendiente) y se encola la transcripción.

* **CA2:** Un proceso en segundo plano consume la cola; si el G7 responde, se actualiza el resultado en el G3 con el score.

* **CA3:** Si el G7 falla, el registro no se pierde: vuelve a la cola incrementando su contador de reintentos.

* **Extras:** Existe un endpoint interno para reprocesar manualmente evaluaciones pendientes o fallidas.

**BDD (ESCENARIOS)**

**Característica:** Evaluación asincrónica y tolerante a fallos del uso de IA.

**Escenario 1**

**Dado:** Una entrega técnica validada donde el alumno usó la IA.

**Cuando:** El G5 finaliza el análisis técnico y encola la transcripción.

**Entonces:** La cola procesa el mensaje, obtiene el score y actualiza el resultado en el G3 de forma asincrónica.

**Escenario 2**

**Dado:** Un proceso asincrónico intentando evaluar el uso de IA.

**Cuando:** El Evaluador LLM está caído y devuelve errores repetidos.

**Entonces:** El worker retiene el evento, programa un reintento y no afecta la entrega técnica del alumno.

**Escenario 3**

**Dado:** Evaluaciones que agotaron los reintentos automáticos por una caída prolongada del G7.

**Cuando:** Un administrador invoca el reprocesamiento manual.

**Entonces:** El sistema reenvía los registros estancados, limpiando el backlog.

**PROTOTIPO**

* **Capturas:** N/A (flujo backend y tareas en segundo plano).

* **URL Figma:** N/A.

* **Storybook:** N/A.

* **Mock API / Swagger:** POST /api/ia-evaluaciones/reintentar-fallidos (endpoint interno de administración).

**ESTIMACIÓN / PRIORIDAD**

* **Puntos (Fibonacci):** 

* **Prioridad (MoSCoW):** Must

**DEPENDENCIAS / IMPACTOS**

* **Servicios involucrados:** Evaluador LLM (G7), Motor de Desafíos (G3, para la actualización asincrónica).

* **Módulos afectados:** Sistema de colas, worker asincrónico.

* **Otros equipos / aprobaciones:** Depende del contrato con el Grupo 7 y del endpoint de resultados del Grupo 3\.

* **Impacto en datos / migraciones:** Tabla de cola de evaluaciones con estados y contador de reintentos.

* **Riesgos y mitigación:** Acumulación de backlog ante caídas largas del G7. Mitigación: reproceso manual y alertas.

### **G05-E04-US02 — Entrega resiliente ante caída del servicio de evaluación de IA**

**Descripción (Como / Quiero / Para)**  
 **Como:** Alumno  
 **Quiero:** poder entregar mi resolución aunque el servicio de evaluación de IA esté caído  
 **Para:** no depender de la disponibilidad de servicios externos para completar mi entrega

**Notas / Observaciones**

* **Reglas de negocio:** el score de IA es un dato anexo; la entrega puede considerarse finalizada técnicamente y notificarse al G3 sin ese valor.  
* **Validaciones:** al procesar la entrega se verifica la disponibilidad del veredicto técnico antes de despacharlo.  
* **Datos obligatorios:** identificador de la entrega, veredicto técnico, transcripción del chat (si existió).  
* **Performance:** la caída del evaluador no debe agregar demora perceptible a la entrega del alumno.  
* **Seguridad:** N/A.  
* **Accesibilidad:** N/A (procesos backend y en segundo plano).  
* **Otros:** requiere una cola de evaluaciones con reintentos y un mecanismo de reproceso manual.

**Criterios de Aceptación (CA)**

* **CA1:** si el evaluador de IA no responde, la entrega técnica se procesa y se despacha igualmente al G3, marcando el score de IA como pendiente.  
* **CA2:** la evaluación de IA pendiente se encola y se reintenta automáticamente.  
* **CA3:** existe un mecanismo para reprocesar manualmente las evaluaciones trabadas.

**BDD (escenarios)**  
 **Característica:** Resiliencia de la entrega ante indisponibilidad del Evaluador LLM.

*Escenario 1*  
 **Dado:** una entrega técnica validada mientras el Evaluador LLM está caído.  
 **Cuando:** el sistema intenta obtener el score de IA y no recibe respuesta.  
 **Entonces:** despacha el veredicto técnico al G3 con el score de IA marcado como pendiente y encola la evaluación.

*Escenario 2*  
 **Dado:** una evaluación de IA encolada tras un fallo del Evaluador.  
 **Cuando:** el proceso en segundo plano la reintenta y el Evaluador responde.  
 **Entonces:** el sistema actualiza el resultado en el G3 con el score obtenido.

*Escenario 3*  
 **Dado:** evaluaciones que agotaron los reintentos automáticos por una caída prolongada.  
 **Cuando:** un administrador invoca el reprocesamiento manual.  
 **Entonces:** el sistema reenvía los registros trabados, limpiando el backlog acumulado.

**Prototipo**

* **Capturas:** N/A (flujo backend y tareas en segundo plano).  
* **URL Figma:** N/A.  
* **Storybook:** N/A.  
* **Mock API / Swagger:** POST /api/ia-evaluaciones/reintentar-fallidos (endpoint interno de administración).

**Estimación / Prioridad**

* **Puntos (Fibonacci):**   
* **Prioridad (MoSCoW):** Must

**Dependencias / Impactos**

* **Servicios involucrados:** Evaluador LLM (G7), Motor de Desafíos (G3, para la actualización asincrónica).  
* **Módulos afectados:** sistema de colas, worker asincrónico.  
* **Otros equipos / aprobaciones:** depende del contrato con el Grupo 7 y del endpoint de resultados del Grupo 3\.  
* **Impacto en datos / migraciones:** tabla de cola de evaluaciones con estados y contador de reintentos.  
* **Riesgos y mitigación:** acumulación de backlog ante caídas largas del G7. Mitigación: reproceso manual y alertas.

**G05-E05  Control de Originalidad (Anti-Plagio)     \[Prioridad: Should\]**

**OBJETIVO**

Analizar el código entregado por los alumnos para detectar niveles de similitud sospechosos frente a otras entregas, derivando los casos que superen el umbral a revisión humana, para proteger la integridad académica sin atribuir autoría ni aplicar sanciones de forma automática.

**ALCANCE**

* Comparar cada entrega contra otras entregas para detectar similitud estructural.

* Retener las entregas que superen el umbral, marcándolas como caso de originalidad.

* Derivar esos casos a resolución humana obligatoria por parte del profesor.

**CONSIDERACIONES TÉCNICAS Y DEPENDENCIAS**

* Se propone integrar una herramienta especializada (por ejemplo, JPlag: open source, corre localmente, con análisis estructural resistente a renombrado de variables), en lugar de implementar el motor desde cero.

* Conviene evaluar si el análisis se ejecuta por lote o en el momento de la entrega.

* El sistema no atribuye autoría ni aplica sanciones automáticas: solo bloquea y deriva a revisión humana.

* Depende del Grupo 2 (linaje de curso, para conocer las cohortes pasadas).

**HISTORIAS DE USUARIO**

**G05-E05-US01 — Intercepción de entregas por alta similitud (Anti-Plagio)**

**DESCRIPCIÓN (COMO / QUIERO / PARA)**

**Como:** Motor de Desafíos Prácticos (Sistema)

**Quiero:** comparar el código recibido contra el historial de entregas de la cohorte actual y las pasadas

**Para:** retener los intentos que superen el umbral de similitud y derivarlos a revisión humana

**NOTAS / OBSERVACIONES**

* **Reglas de negocio:** El sistema no atribuye autoría; solo bloquea y exige resolución humana. Umbral de similitud configurable.

* **Validaciones:** Requiere consultar el linaje del curso para conocer las cohortes pasadas.

* **Datos obligatorios:** Código del alumno, identificador de la cohorte.

* **Performance:** La validación se resuelve dentro de tiempos acordes al flujo de evaluación.

* **Seguridad:** Lectura de parámetros globales administrados por rol ADMIN.

* **Accesibilidad:** N/A (proceso backend).

* **Otros:** Se propone apoyar la comparación en una herramienta especializada (ej. JPlag).

**CRITERIOS DE ACEPTACIÓN (CA)**

* **CA1:** El sistema detiene el flujo si la comparación arroja una similitud igual o superior al umbral.

* **CA2:** La entrega interceptada se persiste con el estado "CASO\_ORIGINALIDAD".

* **CA3:** El sistema notifica al Motor Central (G3) que la entrega quedó retenida en revisión manual.

**BDD (ESCENARIOS)**

**Característica:** Control de originalidad y derivación a revisión humana.

**Escenario 1**

**Dado:** Un alumno que envía la resolución de un desafío.

**Cuando:** El motor compara el código y la similitud máxima es baja.

**Entonces:** Permite que el flujo continúe hacia el Sandbox.

**Escenario 2**

**Dado:** Una entrega evaluada por el comparador.

**Cuando:** Se detecta una similitud por encima del umbral con otra entrega de la cohorte.

**Entonces:** Marca la entrega como "CASO\_ORIGINALIDAD" y aborta el envío al Sandbox.

**Escenario 3**

**Dado:** Un curso que es continuación de una edición anterior.

**Cuando:** El motor solicita el linaje y compara contra la cohorte histórica.

**Entonces:** Si la similitud supera el umbral, bloquea la entrega exigiendo revisión humana.

**PROTOTIPO**

* **Capturas:** N/A.

* **URL Figma:** N/A.

* **Storybook:** N/A.

* **Mock API / Swagger:** Proceso interno disparado tras la recepción de una entrega.

**ESTIMACIÓN / PRIORIDAD**

* **Puntos (Fibonacci):** 

* **Prioridad (MoSCoW):** Should

**DEPENDENCIAS / IMPACTOS**

* **Servicios involucrados:** API Gateway, API Cursos (G2), API Backoffice (G12).

* **Módulos afectados:** Pipeline de evaluación de entregas, motor de comparación.

* **Otros equipos / aprobaciones:** El Grupo 2 debe exponer el endpoint de linaje de curso.

* **Impacto en datos / migraciones:** Almacenamiento de representaciones estructurales o hashes de entregas.

* **Riesgos y mitigación:** Lentitud al comparar contra bases históricas grandes. Mitigación: indexación de hashes/tokens en lugar de comparar texto crudo.

### **G05-E05-US02 — Derivación de casos de originalidad a revisión humana**

**Descripción (Como / Quiero / Para)**  
 **Como:** Profesor  
 **Quiero:** que los casos de similitud alta se deriven a mi revisión en lugar de sancionarse automáticamente  
 **Para:** decidir yo, como docente, si hubo plagio o no

**Notas / Observaciones**

* **Reglas de negocio:** el sistema no atribuye autoría ni aplica sanciones automáticas; solo retiene y deriva a resolución humana.  
* **Validaciones:** un caso solo se deriva si la comparación superó el umbral de similitud definido.  
* **Datos obligatorios:** identificador de la entrega, resultado de la comparación de similitud, identificador de la cohorte.  
* **Performance:** la derivación se registra dentro del flujo normal de evaluación de la entrega.  
* **Seguridad:** solo el rol PROFESOR (o superior) puede resolver un caso de originalidad.  
* **Accesibilidad:** Pendiente (vista de revisión del profesor, a definir con Frontend).  
* **Otros:** la resolución del caso por el docente debe quedar registrada.

**Criterios de Aceptación (CA)**

* **CA1:** el sistema no atribuye autoría ni aplica sanciones de forma automática.  
* **CA2:** los casos marcados quedan en un estado que requiere resolución humana obligatoria.  
* **CA3:** el sistema notifica que la entrega quedó retenida a la espera de revisión.

**BDD (escenarios)**  
 **Característica:** Derivación de casos de originalidad a resolución humana.

*Escenario 1*  
 **Dado:** una entrega cuya comparación superó el umbral de similitud.  
 **Cuando:** el sistema procesa el resultado de la comparación.  
 **Entonces:** marca la entrega como caso de originalidad y no aplica ninguna sanción automática.

*Escenario 2*  
 **Dado:** una entrega marcada como caso de originalidad.  
 **Cuando:** el profesor accede a los casos pendientes de revisión.  
 **Entonces:** el sistema le presenta el caso en un estado que exige su resolución manual.

*Escenario 3*  
 **Dado:** un caso de originalidad resuelto por el docente.  
 **Cuando:** el profesor registra su decisión.  
 **Entonces:** el sistema actualiza el estado de la entrega conforme a lo resuelto y conserva el registro de la decisión.

**Prototipo**

* **Capturas:** Pendiente (vista de revisión de casos del profesor).  
* **URL Figma:** Pendiente.  
* **Storybook:** N/A.  
* **Mock API / Swagger:** pendiente de definición (gestión de casos de originalidad).

**Estimación / Prioridad**

* **Puntos (Fibonacci):**   
* **Prioridad (MoSCoW):** Should

**Dependencias / Impactos**

* **Servicios involucrados:** Motor de Desafíos (G3, notificación de estado), Backoffice (G12, parámetros globales).  
* **Módulos afectados:** pipeline de evaluación de entregas, gestión de estados de originalidad.  
* **Otros equipos / aprobaciones:** coordinación con el Grupo 3 para reflejar el estado retenido.  
* **Impacto en datos / migraciones:** estado de originalidad y registro de la resolución docente.  
* **Riesgos y mitigación:** casos sin resolver que bloqueen entregas indefinidamente. Mitigación: listado de pendientes y alertas al docente.

*Nota de alcance: por su complejidad, esta épica se prioriza por debajo de las anteriores. Su valor depende de acordar el enfoque (herramienta, momento de ejecución) antes de comprometer su construcción.*

# **Definition of Done (DoD)**

La Definition of Done es el conjunto de condiciones que toda Historia de Usuario, tarea o incremento debe cumplir para considerarse realmente terminado. No es un estado del tablero, sino la checklist que se verifica antes de mover un elemento a “Terminado”. Está adaptada a la forma de trabajo, las tecnologías y las dependencias reales del equipo.

**UNA TAREA O HISTORIA DE USUARIO SE CONSIDERA TERMINADA CUANDO:**

1. El código compila sin errores y fue subido a la rama correspondiente del repositorio.

2. El código fue revisado por al menos otro integrante del equipo antes de integrarse a la rama principal.

3. La funcionalidad fue probada verificando los criterios de aceptación de la historia.

4. El código respeta la estructura de paquetes y las convenciones acordadas por el equipo.

5. La tarea está integrada a la rama principal sin romper funcionalidades previamente terminadas, verificado tras la integración.

6. Cuando la funcionalidad involucra comunicación con otro microservicio, el contrato o interfaz está definido y probado, con una implementación provisoria (mock) si el otro servicio o el Gateway aún no están disponibles.

7. Se actualizó la documentación mínima necesaria cuando el cambio lo requiere.

8. La tarjeta correspondiente en TAIGA fue actualizada a su estado final.

*Criterio de verificación de no regresión: la comprobación de que una integración “no rompe lo previo” se realiza levantando la aplicación y probando manualmente los flujos principales luego de integrar los cambios.*











