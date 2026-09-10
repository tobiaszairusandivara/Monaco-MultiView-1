# PROGRAMACIÓN IV — BACK END
## Propuesta de Arquitectura

**2° Año – 4° Cuatrimestre**
**Tecnicatura Universitaria en Programación — UTN Facultad Regional Córdoba**

---

## Índice

- [1. Arquitectura de referencia](#1-arquitectura-de-referencia)
  - [1.1 Reglas no negociables](#11-reglas-no-negociables)
  - [1.2 El recorrido de una solicitud](#12-el-recorrido-de-una-solicitud)
  - [1.3 Sincrónico o evento](#13-sincrónico-o-evento)
  - [1.4 El curso-cohorte como contexto](#14-el-curso-cohorte-como-contexto)
- [2. Asignación por tema](#2-asignación-por-tema)
  - [Tema 01 — Identidad y Usuarios](#tema-01--identidad-y-usuarios)
  - [Tema 02 — Cursos y Matrícula](#tema-02--cursos-y-matrícula)
  - [Tema 03 — Motor de Desafíos](#tema-03--motor-de-desafíos)
  - [Tema 04 — Teóricos y Encuestas](#tema-04--teóricos-y-encuestas)
  - [Tema 05 — Desafíos Prácticos](#tema-05--desafíos-prácticos)
  - [Tema 06 — Sandbox / Runtime](#tema-06--sandbox--runtime)
  - [Tema 07 — Evaluación LLM](#tema-07--evaluación-llm)
  - [Tema 08 — Banco](#tema-08--banco)
  - [Tema 09 — Mercado](#tema-09--mercado)
  - [Tema 10 — Roadmap y Progreso](#tema-10--roadmap-y-progreso)
  - [Tema 11 — Social y Notificaciones](#tema-11--social-y-notificaciones)
  - [Tema 12 — Backoffice](#tema-12--backoffice)
- [3. Decisiones abiertas](#3-decisiones-abiertas)
- [4. Procesos en detalle](#4-procesos-en-detalle)
  - [4.1 Arquitectura front end / back end](#41-arquitectura-front-end--back-end)
  - [4.2 Institución, curso template y curso-cohorte](#42-institución-curso-template-y-curso-cohorte)
  - [4.3 Núcleo de desafíos](#43-núcleo-de-desafíos)
  - [4.4 Bus de eventos](#44-bus-de-eventos)
  - [4.5 Economía y progreso](#45-economía-y-progreso)
  - [4.6 Backoffice y parámetros compartidos](#46-backoffice-y-parámetros-compartidos)
  - [4.7 Identidad, pertenencia y autorización](#47-identidad-pertenencia-y-autorización)
- [Aclaración final](#aclaración-final)

---

## 1. Arquitectura de referencia

Este documento reúne tres cosas: las decisiones de arquitectura que valen para toda la plataforma, el reparto de trabajo por tema, y los procesos que cruzan a varios equipos a la vez. Está pensado para leerse antes de escribir código.

Lo que se define acá es de plataforma y no se renegocia equipo por equipo. Dentro de esos límites, cada equipo decide el diseño interno de su servicio.

### 1.1 Reglas no negociables

- **El API Gateway es la única puerta de entrada.** Ningún cliente accede a un microservicio por otro camino.
- **Los servicios se registran dinámicamente.** No hay direcciones fijas escritas en configuración.
- **No hay comunicación directa entre microservicios.** Toda llamada sincrónica vuelve a pasar por el gateway.
- **Cada servicio es dueño exclusivo de su base.** Nadie lee la tabla del vecino ni comparte esquema.
- **Lo asincrónico viaja por el bus de eventos**, no por el gateway.
- **Cada entidad tiene un dueño único.** Si dos equipos creen ser dueños del mismo dato, se resuelve en la sesión de integración.

### 1.2 El recorrido de una solicitud

**Alta dinámica.** Cuando un microservicio levanta, lo primero que hace es registrarse: informa su nombre lógico, su ubicación y su estado de salud. Si mañana levantan tres instancias del mismo servicio, las tres se dan de alta solas; si una se cae, el registro la da de baja.

**Entrada única.** El cliente conoce una sola dirección: la del gateway. Esto no es una preferencia de estilo: es lo que permite resolver autenticación, límites de uso y trazabilidad en un solo lugar en vez de replicarlos doce veces.

**Resolución.** El gateway no sabe de antemano dónde vive nadie. Ante cada solicitud consulta el registro y obtiene una instancia viva. Ahí es donde entra el balanceo entre instancias.

**Ruteo.** Recién entonces el gateway reenvía la solicitud al microservicio resuelto, con el token ya validado y el contexto de usuario propagado.

**Procesamiento.** El microservicio ejecuta su lógica contra su propia base. No consulta datos ajenos por acceso directo.

**Respuesta.** El resultado vuelve al cliente por el mismo camino.

**Comunicación entre servicios.** Si un servicio necesita a otro, sale y vuelve a entrar por el gateway. Desde el punto de vista del servicio llamado, el otro microservicio es un consumidor externo más.

Una llamada directa entre microservicios rompe todo lo anterior: pierde el balanceo, se acopla a un despliegue puntual, se saltea la validación centralizada y desaparece de la traza. El acoplamiento por base de datos es la misma falta, solo que más difícil de detectar.

### 1.3 Sincrónico o evento

La regla cabe en una línea: si necesito la respuesta para continuar, es sincrónico por el gateway; si solo estoy avisando que algo pasó, es un evento.

Dos casos del mismo servicio ilustran la diferencia. El Tema 02 le pregunta al Tema 07 si la calibración del curso está aprobada, y necesita ese sí para poder activar: es sincrónico. El mismo Tema 02 publica que archivó un curso, sin esperar nada de nadie: es un evento, y quien esté suscrito reacciona.

### 1.4 El curso-cohorte como contexto

Casi ninguna entidad de la plataforma existe fuera de un curso-cohorte. Las recompensas se usan únicamente en el curso donde se obtuvieron; la calibración es por curso y condiciona su activación; el ranking es dentro de la cohorte; las mecánicas de enganche se desactivan por curso.

Eso convierte al curso-cohorte en el concepto compartido más importante del sistema: es la clave que viaja en cada operación y contra la que se acota cada consulta. Si un equipo modela sus entidades sin esa clave, después no hay forma de acotarlas sin migrar datos.

Ahora bien, el curso-cohorte es el contexto de la conversación, no el conducto. El Tema 02 es dueño de su identidad y de su ciclo de vida, no del contenido que vive adentro, y no media las operaciones del dictado.

---

## 2. Asignación por tema

Cada tema se presenta en tres columnas. No son etapas rígidas de un cronograma: son un criterio de prioridad.

**Pedido para empezar:** el núcleo del dominio más todo aquello que otros equipos necesitan para no quedar bloqueados. Si algo aparece en un contrato que otro equipo consume, va en esta columna aunque sea lo menos vistoso del tema.

**Para más adelante:** lo que puede diferirse sin frenar a nadie, pero que debe quedar previsto en el modelo y en el contrato. "Más adelante" no significa "no lo pienso": significa que se diseña ahora y se implementa después.

**Podría ser:** lo que suma si el núcleo está entregado y funcionando. Un extra a medias vale menos que un núcleo terminado.

### Tema 01 — Identidad y Usuarios

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Registro y autenticación | Persistencia y consulta de auditoría | Personalización avanzada de perfil |
| Roles: ADMIN, responsable, profesor, alumno | Retención: 5 años configurable, sin purga automática, decisión de ADMIN | Identidad institucional |
| Perfil de usuario | Revocación de sesión | Doble factor |
| Contrato del token: claims y vigencia | Recuperación de contraseña y verificación por correo | API Gateway (extra asignado) |
| Validación de padrón en el onboarding | | |
| Borrado lógico en el modelo | | |
| Emisión de eventos de auditoría | | |

*La purga y anonimización de PII (RSK-11) está diferida por decisión del product owner: queda declarada como fuera de alcance.*

### Tema 02 — Cursos y Matrícula

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Alta de curso | Clonado con linaje | Servicio de presencialidad |
| Comisiones | Fechas relativas al clonar | Plantillas de curso reutilizables |
| Inscripción de alumnos | Calibración que se copia pero se reaprueba | Importación masiva de alumnos |
| Código de invitación de un solo uso | Bloqueo de cierre con notas diferidas pendientes | |
| Ciclo de vida y archivado | | |
| Gatillo de purga del chat al archivar | | |
| Bloqueo de activación sin calibración aprobada | | |

*El linaje de curso es prerrequisito del control de originalidad contra ediciones anteriores: sin linaje, el Tema 05 no puede cumplir su alcance.*

### Tema 03 — Motor de Desafíos

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Ciclo de vida del desafío | Entrega tardía con penalidad del 30% en ventana de 48 h | Colaboración en equipo sobre una misma entrega |
| Publicación y asignación | Prórroga individual auditada | Agenda del alumno |
| Entregas y estados | Vencimiento sin entrega que no descuenta vida | Plantillas de desafío |
| Versionado | Desafíos personalizados por LLM, sin XP ni monedas | |
| Fechas de apertura y cierre | Límite semanal de generación | |
| Cierre evaluado al momento del envío | | |

*Las vidas quedan asignadas al Tema 10. El Tema 03 emite el hecho; el Tema 10 decide su efecto sobre vidas y XP.*

### Tema 04 — Teóricos y Encuestas

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Ítems teóricos | Exposición de resultados al profesor con umbral de 5 respuestas | Banco de ítems con etiquetado por tema |
| Corrección | Tipos de ítem adicionales | Analítica de dificultad por ítem |
| Encuesta obligatoria con abstención explícita | Agregados por cohorte | Generación asistida de ítems |
| Marcador de cumplimiento desacoplado de la respuesta | | |
| Contrato con 03 y 05: se dispara antes de revelar resultados | | |

*El gatillo de la encuesta implica que 03 y 05 no muestran nota hasta que el 04 confirme. Es la dependencia menos visible del reparto.*

### Tema 05 — Desafíos Prácticos

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Consignas de código | Control de originalidad entre entregas, umbral del 70% | Múltiples lenguajes |
| Casos de prueba | Comparación contra ediciones anteriores | Feedback enriquecido con trazas de ejecución |
| Formato de entrega | Caso de originalidad con resolución humana obligatoria | Pistas progresivas |
| Feedback al alumno | Sin atribución automática de autoría | |
| Comunicación con el sandbox | | |

*El control de originalidad es alcance cerrado del PRD, no una mejora opcional.*

### Tema 06 — Sandbox / Runtime

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Ejecución aislada | Cola de ejecuciones y comportamiento en pico de cierre | Almacenamiento de artefactos de ejecución |
| Límites de CPU, memoria y tiempo | Política ante caída del sandbox | Más lenguajes |
| Captura de salida | Análisis estático de código | Ejecución con dependencias externas |
| Contrato de invocación con el Tema 05 | | |

*Con fechas de cierre definidas, las entregas se concentran: el comportamiento bajo carga deja de ser hipotético.*

### Tema 07 — Evaluación LLM

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Rúbricas con pesos fijos 30/25/20/15/10 | Detección de deriva previa a activar un modelo | Tablero de deriva del evaluador |
| Invocación del modelo | Caída del LLM: nota neutra o cálculo diferido | Configuración centralizada |
| Golden set base | Rúbrica portable entre modelos | Caché de evaluaciones |
| Calibración por curso | Bloqueo de cierre con diferidas pendientes | Control de costo por curso |
| Bloqueo de activación sin override | | |
| Salvaguarda anti-fuga | | |

*El golden set depende de producción de contenido docente, no de desarrollo: es una dependencia externa al equipo.*

### Tema 08 — Banco

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Ledger de movimientos | Reversión de movimientos, necesaria por el XP reducible | Historial exportable |
| Transacciones | Acreditación de rachas y misiones | Límites por período |
| Saldos con alcance por curso | Multiplicador de eventos con techo de 3x | Tablero de circulante por curso |
| Reglas de acreditación | Conciliación | |
| Reservas | | |

*No existe saldo global: las recompensas se usan únicamente en el curso donde se obtuvieron.*

### Tema 09 — Mercado

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Catálogo | Subastas con ventana temporal | Intercambio entre alumnos |
| Compra contra reserva del banco | Acceso móvil a subastas | Ítems por temporada |
| Inventario del alumno con alcance por curso | Vencimiento de ítems | Catálogo configurable por curso |
| Consumo de ítems | | |

*Es el tema más liviano del reparto: los extras son el mecanismo previsto para equilibrarlo.*

### Tema 10 — Roadmap y Progreso

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Grafo de contenidos | XP retroactivamente reducible | Visualización del recorrido |
| Prerequisitos y desbloqueo | Rachas y misiones que pagan solo en monedas e insignias | Comparativas de cohorte |
| XP y niveles | Temporadas como ventana de ranking, sin reinicio de XP | Recomendación del siguiente contenido |
| Logros e insignias | Bloque desactivable por curso | |
| Vidas | | |
| Ranking con zonas P90/P10 | | |

*El XP reducible impide modelar el progreso como contador incremental: se necesita historial.*

### Tema 11 — Social y Notificaciones

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Contrato de eventos del bus | Reportes de contenido y moderación | Mensajería asíncrona como servicio de plataforma |
| Notificaciones que comunican hechos, no reenganche | Eventos nuevos: vencimientos, casos de originalidad, hitos de racha | Chat en móvil |
| Chat sin retención | Preferencias de notificación | Menciones y adjuntos |
| Purga al archivar, con excepción por reporte | | |
| Equipos | | |

*Define el contrato de eventos para toda la plataforma: su decisión condiciona a cinco equipos.*

### Tema 12 — Backoffice

| Pedido para empezar | Para más adelante | Podría ser |
|---|---|---|
| Administración de plataforma | Panel del profesor con indicador de alumno en riesgo | Exportación de datos |
| Registro de parámetros PAR-01 a PAR-24 | Frescura máxima de 15 minutos en los datos | KPIs con CSAT de 5 estrellas |
| Gestión del proveedor LLM, exclusiva de ADMIN | Sin comparación entre docentes | Alertas configurables |
| Contratos de lectura con los seis temas que le proveen datos | Reportes docentes | |

*Es consumidor puro: sin contratos de lectura acordados en el sprint 1 no tiene nada demostrable.*

---

## 3. Decisiones abiertas

Los puntos que siguen no están cerrados en el PRD y afectan a más de un equipo. Conviene resolverlos antes de que cada equipo adopte su propia interpretación.

**Caída del sandbox.** El PRD define qué ocurre si el evaluador LLM no responde, pero no la regla equivalente para el sandbox. Hoy nadie sabe qué pasa con una entrega en ese caso.

**Transversales sin dueño.** Arquitectura multi-idioma, alcance de la versión móvil y marco de indicadores no están asignados a ningún tema.

**Desmatriculación a mitad de cuatrimestre.** Las monedas, el inventario y el progreso de un alumno quedan acotados a un curso al que ya no pertenece. Afecta a los temas 02, 08, 09 y 10 a la vez.

---

## 4. Procesos en detalle

Las siete láminas que siguen desarrollan los procesos que cruzan a varios equipos. Cada una es autónoma: puede imprimirse y discutirse por separado.

### 4.1 Arquitectura front end / back end

Muestra el recorrido completo de una solicitud, el registro dinámico de servicios y el motivo por el que la comunicación directa entre microservicios está prohibida. El recuadro del punto 7 es la pieza clave: cuando un servicio necesita a otro, el camino vuelve a pasar por el gateway.

> **Lámina 1 — Enrutamiento centralizado, registro dinámico y comunicación controlada**
>
> **Flujo resumido:**
> 1. El cliente envía la solicitud al API Gateway.
> 2. Cada microservicio se registra dinámicamente en Service Discovery.
> 3. El API Gateway consulta Service Discovery para ubicar el servicio.
> 4. El API Gateway enruta la solicitud al microservicio correcto.
> 5. El microservicio procesa la lógica y usa su propia base de datos.
> 6. La respuesta vuelve por el API Gateway hacia el Front End.
> 7. Si otro microservicio necesita algo, también debe pasar por el API Gateway.
>
> **Reglas clave:** única entrada (API Gateway) · descubrimiento dinámico (Service Discovery) · sin comunicación directa entre microservicios · cada microservicio mantiene su propia base de datos (aislamiento y autonomía por servicio).

### 4.2 Institución, curso template y curso-cohorte

El template define y se reutiliza; la cohorte ocurre. Los dos estados en ámbar no son etapas más difíciles: son estados que no se alcanzan hasta que otro servicio da el visto bueno. La regla de modelado al pie es el chequeo más rápido sobre el diseño propio: si una entidad no puede ubicarse dentro de la caja de la cohorte, probablemente esté mal modelada.

> **Lámina 2 — Contención de entidades y ciclo de vida de la cohorte**
>
> **Modelo:** Institución → contiene Curso template (definición reutilizable) → se instancia por cohorte → Curso-cohorte (instancia dictada), que contiene: Teóricos, Prácticos, Desafíos, Roadmap y Matrícula.
>
> **Ciclo de vida de la cohorte** (aplica solo a la cohorte, no al template): Creación → Configuración → **Activación** (requiere calibración aprobada) → Dictado → **Cierre** (requiere evaluaciones sin pendientes) → Archivado (purga de chat y retención).
>
> **Reglas clave:** el template define, la cohorte ocurre · el template no tiene ciclo de vida operativo · el contenido pertenece a una cohorte concreta · la matrícula vincula personas con la cohorte.

### 4.3 Núcleo de desafíos

Teórico y práctico no son dos cosas distintas: son dos tipos de desafío. Comparten ciclo de vida, estados, fechas, entrega y resultado, y todo eso vive una sola vez en el Tema 03. Si el 04 o el 05 pudieran otorgar XP por su cuenta, las reglas de la economía quedarían escritas en tres lugares. El evaluador y el sandbox, en cambio, no conocen desafíos, cursos ni alumnos.

> **Lámina 3 — Propiedad, evaluación y economía del desafío**
>
> **Idea de fondo:** teórico y práctico no son dos cosas distintas; son dos tipos de desafío, con núcleo común en el Tema 03.
>
> - El 04 (Teóricos) y el 05 (Prácticos) invocan al 07 (LLM); el 07 no conoce desafíos, cursos ni alumnos.
> - Solo el 05 ejecuta código en el 06 (Sandbox); ambos usan el evaluador con rúbricas distintas.
> - El 03 recibe una nota ya formada y no le importa cómo se produjo.
> - Ni el 04 ni el 05 otorgan XP: la regla de la economía vive en un solo lugar (el 03).
> - Si el LLM se cae, nota neutra o diferida; para el sandbox no hay regla aún.
> - El vencimiento sin entrega no descuenta vida: esa regla se aplica en el 10.
>
> *Detalle PRD: los desafíos personalizados generados por LLM siguen siendo desafíos del 03, pero no pagan XP ni monedas, solo insignias cosméticas.*
> *Hueco del PRD: si el sandbox no responde, hoy no existe una regla definida. Conviene cerrarlo antes de implementar.*
> *Con evaluaciones diferidas pendientes, el curso no puede cerrarse.*

### 4.4 Bus de eventos

Un evento es un hecho consumado. Quien lo publica no sabe quién escucha, no espera respuesta y no necesita conocer a sus consumidores: si aparece un consumidor nuevo, se suscribe y nadie toca el emisor. El Tema 11 tiene un rol incómodo: define el contrato de eventos para toda la plataforma y a la vez es uno de los consumidores. Su contrato condiciona a cinco equipos.

> **Lámina 4 — Publicación, suscripción y desacople**
>
> **Idea de fondo:** si necesito la respuesta para continuar, es sincrónico por el gateway; si solo aviso que algo pasó, es un evento.
>
> - Productores: Tema 02 (ciclo del curso), Tema 03 (desafío resuelto), Tema 10 (racha o misión) → publican en el **Bus de eventos** (contrato definido por el Tema 11).
> - Consumidores: Tema 08 (monedas), Tema 10 (XP y vidas), Tema 11 (avisos), Tema 01 (retención), Tema 12 (analítica).
> - **Ejemplo sincrónico:** el Tema 02 consulta al 07 si la calibración está aprobada; necesita la respuesta "sí" para activar.
> - **Ejemplo por evento:** el Tema 02 publica que el curso fue archivado; no espera respuesta, los consumidores reaccionan si están suscritos.
> - El Tema 11 define el contrato de eventos para toda la plataforma y además consume eventos (doble rol).

### 4.5 Economía y progreso

Hay dos monedas conceptuales y no son intercambiables: el XP mide progreso académico y no se gasta; las monedas son poder de compra. Las rachas pagan en monedas, nunca en XP, porque si no el ranking mediría constancia en vez de aprendizaje. La compra no puede ser "descuento y después entrego": se reserva, se confirma y si algo falla se libera. Y como el XP puede bajar retroactivamente, ni el progreso ni el saldo son contadores que solo suben.

> **Lámina 5 — XP, monedas y confirmación de compra**
>
> **Idea de fondo:** el Tema 03 emite un solo hecho y dos servicios distintos lo interpretan: el 10 lo lee como avance, el 08 como acreditación.
>
> - El resultado del desafío (Tema 03) se convierte en XP, niveles y vidas dentro del Tema 10, y en monedas dentro del Tema 08 (único que lleva el ledger).
> - XP ≠ monedas: rachas y misiones pagan en monedas e insignias, nunca en XP.
> - El Mercado (Tema 09) reserva contra el banco y recién después confirma la compra.
> - Si el XP es retroactivamente reducible, obliga a reversión de movimientos.
> - Todo tiene alcance por curso, sin excepción: no existe saldo global.

### 4.6 Backoffice y parámetros compartidos

Es el único tema sin dominio propio: todo lo que muestra pertenece a otro. Eso le crea un problema de secuencia que nadie más tiene, porque no puede mostrar nada hasta que seis equipos expongan sus lecturas. Los parámetros de la economía los administra en exclusiva, pero los aplican el 03, el 05, el 08 y el 10: esos cuatro tienen que leer su configuración de algún lado en vez de tenerla fija en el código.

> **Lámina 6 — Consumidor transversal sin dominio propio**
>
> **Idea de fondo:** el Tema 12 no produce datos propios; su valor está en leer, cruzar y administrar parámetros compartidos.
>
> - El Tema 12 integra lecturas de: Tema 02 (matrícula/ciclo), Tema 03 (desafíos/resultados), Tema 05 (entregas/corrección), Tema 08 (saldos/ledger), Tema 10 (progreso/XP) y Tema 11 (avisos/eventos).
> - No puede avanzar solo: depende de que otros equipos expongan contratos de lectura temprano.
> - Administra en exclusiva los **Parámetros PAR-01 a PAR-24**, consumidos por el Tema 03, 05, 08 y 10.
> - Los parámetros no deben quedar hardcodeados en cada servicio.
>
> *Atención: si no se acuerdan contratos de lectura en el sprint 1, el Backoffice queda bloqueado.*

### 4.7 Identidad, pertenencia y autorización

Son dos preguntas distintas con dueños distintos: quién sos y qué rol tenés lo responde el Tema 01; a qué cohorte pertenecés lo responde el Tema 02. Un profesor lo es en la plataforma, pero solo es profesor de esta cohorte si la matrícula lo dice.

Validar no es autorizar. El gateway comprueba que el token sea auténtico y esté vigente; decidir si esta persona puede hacer esta acción es otra cosa, y suele pertenecer al servicio dueño de la regla. Dónde se resuelve la autorización es una decisión de diseño que cada equipo debe justificar.

> **Lámina 7 — Token, cohorte y decisión de autorización**
>
> **Idea de fondo:** el Tema 01 responde quién sos y qué rol tenés; el Tema 02 responde a qué cohorte pertenecés. Son datos distintos y no deben duplicarse.
>
> - Identidad y Usuarios (Tema 01): Padrón (validación previa) → Registro (alta, perfil y rol) → Login (emisión del token). El token lleva identificador, rol y vigencia.
> - El API Gateway valida autenticidad y vigencia del token en cada solicitud.
> - Quién sos y qué rol tenés lo responde el 01; a qué cohorte pertenecés lo responde el 02.
> - Ningún servicio debería implementar su propia autenticación ni duplicar roles o pertenencia.
> - ADMIN es rol de plataforma; profesor responsable, profesor y alumno solo tienen sentido acompañados por la pertenencia a cohorte.
>
> *Decisión de diseño abierta: ¿la autorización se resuelve en el gateway o en cada servicio?*

---

## Aclaración final

El presente documento constituye una **propuesta inicial de trabajo** y no necesariamente representa la solución definitiva del TPI. Su objetivo es brindar un **punto de partida común**, estableciendo lineamientos, criterios y posibles caminos de análisis para que cada equipo pueda comenzar a desarrollar su propuesta.

A partir de esta base, cada equipo deberá **relevar, analizar y validar la información necesaria**, evaluar las alternativas planteadas y determinar si corresponde mantener esta propuesta, ajustarla o desarrollar una solución superadora que responda de mejor manera a las necesidades del proyecto.

Asimismo, se deja constancia de que este documento fue elaborado con **asistencia de herramientas de Inteligencia Artificial (IA)**. Por este motivo, algunos procesos, definiciones o propuestas pueden contener imprecisiones, estar incompletos o requerir una mayor profundización.

En consecuencia, el contenido presentado **no debe interpretarse como una especificación cerrada**, sino como material de referencia que deberá ser revisado, cuestionado, validado y enriquecido por los equipos durante el desarrollo del TPI.

---

**Atribución-No Comercial-Sin Derivadas**

Se permite descargar esta obra y compartirla, siempre y cuando no sea modificado y/o alterado su contenido, ni se comercialice. Referenciarlo de la siguiente manera:

> Universidad Tecnológica Nacional Facultad Regional Córdoba (S/D). Material para la Tecnicatura Universitaria en Programación, modalidad virtual, Córdoba, Argentina.
