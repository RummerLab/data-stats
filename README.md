# data-stats

Location of nurseries: https://umap.openstreetmap.fr/en/map/shark-nurseries-on-moorea-island-french-polynesia_295561

```javascript
async function getMapJsonPath(mapId) {
    const url = `https://umap.openstreetmap.fr/en/map/${mapId}/geojson/`
    const fileName = `${mapId}.json`
    return downloadAndCacheJson(url, fileName)
}

async function getLayerJsonPath(mapId, layerId) {
    const url = `https://umap.openstreetmap.fr/en/datalayer/${mapId}/${layerId}/`
    const fileName = `${layerId}.geojson`
    return downloadAndCacheJson(url, fileName)
}
```
