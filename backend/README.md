# ZingoMessenger Backend (Kotlin/Ktor)

Primul pas: Register + Login.

## 1) Configurare DB (.env)

Backend-ul citeste `.env` din folderul in care rulezi jar-ul.
Poti folosi `ENV_FILE=/cale/catre/.env` daca nu rulezi din folderul cu `.env`.

### SQLite (simplu)

`backend/.env`:
```
DB_TYPE=sqlite
DB_SQLITE_PATH=./data/zingo.db
```

### MySQL

`backend/.env`:
```
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=zingo
DB_USER=zingo
DB_PASS=zingo
```

## 2) Rulare (dev)

```bash
cd backend
./gradlew run
```

## 3) Rulare (jar)

```bash
PORT=8080 java -jar build/libs/zingo-backend-0.1.0-all.jar
```

Daca `.env` este in alt folder:
```bash
ENV_FILE=/cale/catre/.env PORT=8080 java -jar zingo-backend-0.1.0-all.jar
```

## 4) Test register

```bash
curl -X POST http://localhost:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"mihai","email":"mihai@example.com","password":"Secret123","passwordConfirm":"Secret123","birthDate":"2000-01-01"}'
```

## 5) Test login

```bash
curl -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"mihai","password":"Secret123"}'
```
