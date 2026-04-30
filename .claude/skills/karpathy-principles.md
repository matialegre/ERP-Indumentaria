---
name: karpathy-principles
description: Four principles to reduce common LLM coding mistakes. Apply on every non-trivial change. Based on observations by Andrej Karpathy.
---

# Karpathy Coding Principles

Aplicar en cada tarea no-trivial. Sesgan hacia precaución por sobre velocidad — para cambios triviales, usar criterio.

## 1. Pensar antes de escribir

**No asumir. No esconder confusión. Exponer tradeoffs.**

Antes de implementar:
- Enunciar suposiciones explícitamente. Si hay incertidumbre, preguntar.
- Si existen múltiples interpretaciones, presentarlas — no elegir en silencio.
- Si hay un enfoque más simple, decirlo. Empujar atrás cuando corresponda.
- Si algo no está claro, detenerse. Nombrar qué confunde. Preguntar.

## 2. Simplicidad primero

**Código mínimo que resuelve el problema. Nada especulativo.**

- Nada de features más allá de lo pedido.
- Nada de abstracciones para código de un solo uso.
- Nada de "flexibilidad" o "configurabilidad" que no se pidió.
- Nada de error handling para escenarios imposibles.
- Si escribís 200 líneas y pudieron ser 50, reescribir.

Test: "¿Un ingeniero senior diría que esto está sobre-complicado?" Si sí, simplificar.

## 3. Cambios quirúrgicos

**Tocar solo lo necesario. Limpiar solo tu propio desorden.**

Al editar código existente:
- No "mejorar" código adyacente, comentarios ni formato.
- No refactorizar cosas que no están rotas.
- Respetar el estilo existente, incluso si vos lo harías diferente.
- Si ves código muerto no relacionado, mencionalo — no lo borres.

Cuando tus cambios generen huérfanos:
- Remover imports/variables/funciones que TUS cambios dejaron sin uso.
- No remover código muerto preexistente a menos que se pida.

Test: Cada línea cambiada debe mapearse directamente a lo pedido por el usuario.

## 4. Ejecución orientada a objetivos

**Definir criterios de éxito. Iterar hasta verificar.**

Transformar tareas en objetivos verificables:
- "Agregar validación" → "Escribir tests con inputs inválidos, después hacerlos pasar"
- "Arreglar el bug" → "Escribir un test que lo reproduzca, después hacerlo pasar"
- "Refactor X" → "Asegurar que los tests pasan antes y después"

Para tareas multi-paso, enunciar un plan breve:
```
1. [paso] → verificar: [check]
2. [paso] → verificar: [check]
3. [paso] → verificar: [check]
```

Criterios fuertes permiten iterar solo. Criterios débiles ("que funcione") requieren clarificación constante.

---

## Cómo saber que está funcionando

- Menos cambios innecesarios en los diffs
- Menos reescrituras por sobre-complicación
- Las preguntas de clarificación vienen ANTES de implementar, no después de equivocarse

Fuente: [andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)
