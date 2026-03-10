# ZingoMessenger Frontend (Kotlin Compose Web)

Frontend-ul este acum Kotlin Multiplatform (Compose) cu target web (wasm). Urmatorii pasi vor adauga Android si Linux.

## Configurare API (.env)

Editeaza `frontend/.env`:
```
API_BASE=http://localhost:8080
```

## Rulare web

```bash
cd frontend
./gradlew wasmJsBrowserDevelopmentRun
```

Deschide URL-ul afisat in consola (de obicei `http://localhost:8080`).

## Build web

```bash
cd frontend
./gradlew wasmJsBrowserProductionWebpack
```

Output-ul este in `frontend/build/dist/wasmJs/productionExecutable/`.
