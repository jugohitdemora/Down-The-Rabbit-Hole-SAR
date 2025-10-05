# Solución: Imágenes Invisibles en el Visor SAR

## 🔍 Problema Original

Las capas dinámicas (water/wetness, SAR RGB, etc.) no se mostraban visualmente en el mapa, a pesar de que:
- ✅ Las peticiones HTTP a Google Storage se hacían correctamente
- ✅ Las respuestas contenían las imágenes válidas
- ✅ No había errores en la consola del navegador

Los usuarios podían ver en las herramientas de desarrollo del navegador que las imágenes se descargaban exitosamente, pero no aparecían en el mapa.

## 🤔 Proceso de Pensamiento

### 1. Identificación de Posibles Causas

Cuando las imágenes se cargan pero no se ven, típicamente el problema puede estar en:

1. **CSS que oculta elementos:**
   - `display: none`
   - `visibility: hidden`
   - `opacity: 0`
   - `z-index` incorrecto (capas debajo de otras)
   - **`mix-blend-mode`** problemático (← principal sospechoso)
   - Filtros CSS que distorsionan

2. **JavaScript:**
   - Capas no añadidas al mapa
   - Capas removidas inmediatamente después de añadirse
   - Configuración incorrecta de panes en Leaflet
   - URLs incorrectas (pero esto causaría errores 404)

3. **Leaflet:**
   - Panes mal configurados
   - z-index de panes conflictivos
   - Tiles fuera del viewport visible

### 2. Estrategia de Diagnóstico

Dado que las imágenes se descargaban correctamente, el problema NO era de red ni de backend. El problema estaba en la **presentación/renderizado**.

La estrategia fue:
1. **Agregar logs extensivos** para entender el flujo completo
2. **Inspeccionar CSS** buscando reglas que puedan ocultar elementos
3. **Comentar reglas sospechosas** para aislar el problema

## 🐛 Diagnóstico y Logs Agregados

### Logs en JavaScript (`app.js`)

#### 1. Configuración de Panes
```javascript
console.log('🗺️ Map panes configured:');
console.log('  dynamic z-index:', map.getPane('dynamic').style.zIndex);
// Verificar que los z-indexes estén correctos
```

#### 2. Creación de Capas
```javascript
console.log('🔨 makeTile() creating layer:', { layerKey, quarter, opacity, url });
// Ver qué parámetros se están usando
```

#### 3. Actualización de Capas
```javascript
console.log('🔄 updateLayer() called:', { layerKey: k, quarter: q, opacity: op });
console.log('✅ activeLayer added to map, pane:', activeLayer.options.pane);
// Confirmar que las capas se agregan al mapa
```

#### 4. Eventos de Tiles de Leaflet
```javascript
layer.on('tileloadstart', (e) => {
  console.log('🔽 Tile load started:', e.coords, 'URL:', e.tile.src);
});
layer.on('tileload', (e) => {
  console.log('✅ Tile loaded successfully:', e.coords);
});
layer.on('tileerror', (e) => {
  console.warn('❌ Tile load error:', e.coords);
});
```

#### 5. Función de Debug Interactiva
```javascript
window.debugMap = function() {
  // Inspeccionar estado completo del mapa
  // Listar todas las capas activas
  // Verificar z-indexes de panes
  // Contar elementos hijos en cada pane
};
```

## ✅ Solución Encontrada

### El Culpable: `mix-blend-mode: screen`

En `styles.css` líneas 354-357:

```css
/* ANTES (causaba el problema) */
.sar-dyn-tiles{
  mix-blend-mode: screen;                 /* ← PROBLEMA */
  filter: brightness(1.35) contrast(1.6);
}
```

### ¿Por Qué Causaba el Problema?

El modo de mezcla `screen` funciona de la siguiente manera:
- Multiplica la inversa de los colores de la capa con la inversa de los colores del fondo
- Resulta en colores más claros
- **Problema:** Con ciertos contenidos de imagen (especialmente imágenes SAR sobre imagery satelital oscuro), puede resultar en píxeles completamente transparentes o blancos invisibles

En este caso específico:
- Las imágenes SAR tienen valores particulares de píxel
- Al aplicar `mix-blend-mode: screen` sobre el basemap de Esri World Imagery
- La combinación resultaba en píxeles que no se distinguían o eran invisibles

### Solución Implementada

```css
/* DESPUÉS (solucionado) */
.sar-dyn-tiles{
  /* mix-blend-mode: screen; */                /* COMENTADO */
  /* filter: brightness(1.35) contrast(1.6); */ /* COMENTADO */
}
```

Al comentar estas propiedades CSS, las imágenes se muestran normalmente con su opacidad configurada (0.85-0.9) sin modos de mezcla problemáticos.

## 🎯 Lecciones Aprendidas

### 1. Orden de Diagnóstico para "Carga pero no se Ve"

Cuando algo se carga pero no es visible:

1. **Primero revisa CSS**, especialmente:
   - `mix-blend-mode`
   - `filter`
   - `opacity`
   - `z-index`
   - `display` / `visibility`

2. **Luego revisa JavaScript:**
   - ¿Se agrega la capa al mapa?
   - ¿Se remueve inmediatamente?
   - ¿Están correctos los parámetros?

3. **Finalmente revisa la estructura:**
   - Configuración de Leaflet
   - Orden de capas
   - Panes y z-indexes

### 2. Logging Estratégico

Los logs agregados fueron fundamentales para:
- Confirmar que el código JavaScript funcionaba correctamente
- Verificar que las capas se añadían al mapa
- Ver que los tiles se cargaban exitosamente
- Descartar problemas de JavaScript

Esto nos permitió **enfocar la búsqueda en CSS**.

### 3. `mix-blend-mode` y Datos Científicos

`mix-blend-mode` es útil para efectos visuales, pero **puede ser problemático** con:
- Datos científicos (SAR, multiespectrales, etc.)
- Imágenes con valores de píxel específicos
- Capas que necesitan representación precisa de colores

**Alternativas mejores** para mejorar visibilidad:
- Ajustar `opacity` solamente
- Usar `filter: contrast()` con cuidado
- Pre-procesar las imágenes con mejor contraste
- Usar colormaps más visibles

## 🛠️ Utilidades de Debug Creadas

Se creó una función global `debugMap()` que puedes ejecutar en la consola del navegador:

```javascript
debugMap()
```

Esto muestra:
- Estado de `activeLayer` y `baseSAR`
- Zoom y centro del mapa actual
- Lista de todas las capas con sus configuraciones
- Z-indexes de todos los panes
- Número de elementos hijos en cada pane
- Estilos computados de los panes

**Útil para debugging futuro** sin necesidad de agregar logs temporales.

## 🔄 Si el Problema Vuelve a Aparecer

1. Abre la consola del navegador (F12)
2. Ejecuta `debugMap()`
3. Revisa los z-indexes de los panes
4. Verifica que `activeLayer` no sea `null`
5. Confirma que el pane 'dynamic' tiene hijos (tiles cargados)
6. Revisa los estilos computados del pane 'dynamic'

## 📝 Archivos Modificados

### `app.js`
- ✅ Agregados logs en `updateLayer()`
- ✅ Agregados logs en `makeTile()`
- ✅ Agregados eventos de tiles (`tileload`, `tileerror`, etc.)
- ✅ Agregada función global `debugMap()`
- ✅ Logs de configuración de panes

### `styles.css`
- ✅ Comentadas líneas 356-357 (mix-blend-mode y filter)
- ⚠️ **Se pueden remover permanentemente** o dejar comentadas como documentación

## 🎨 Mejora de Visibilidad (Opciones Futuras)

Si se necesita mejorar el contraste de las imágenes SAR sobre el basemap:

### Opción 1: Solo Opacidad (actual)
```css
.sar-dyn-tiles {
  /* Sin efectos especiales */
}
```

### Opción 2: Contraste Suave
```css
.sar-dyn-tiles {
  filter: contrast(1.2);
}
```

### Opción 3: Mix-blend Alternativo (probar con cuidado)
```css
.sar-dyn-tiles {
  mix-blend-mode: multiply; /* O: overlay, soft-light */
}
```

### Opción 4: Ajuste en las Imágenes Fuente
- Pre-procesar los tiles con mejor contraste
- Aplicar colormaps más visibles antes de exportar
- Ajustar los valores de píxel en el procesamiento GEE

## ✨ Conclusión

El problema era **100% CSS**: una regla `mix-blend-mode: screen` que hacía las imágenes invisibles cuando se combinaban con el basemap satelital. La solución fue simple pero el diagnóstico requirió:

1. **Pensamiento sistemático** descartando posibles causas
2. **Logging estratégico** para confirmar el flujo de JavaScript
3. **Inspección de CSS** para encontrar el culpable
4. **Prueba y error** comentando reglas sospechosas

---

**Fecha:** 5 de octubre, 2025  
**Problema:** Imágenes invisibles a pesar de carga exitosa  
**Causa:** `mix-blend-mode: screen` en CSS  
**Solución:** Comentar/remover la regla CSS problemática  
**Tiempo de resolución:** ~15 minutos con enfoque sistemático
