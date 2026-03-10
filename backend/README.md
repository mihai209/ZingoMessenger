# ZingoMessenger Backend (Kotlin/Ktor)

Scop: primul pas este sistemul de inregistrare (username, email sau telefon, parola, confirmare parola, data nasterii).

## 1) MySQL local

1. Porneste MySQL.
2. Creeaza baza de date si user:

```sql
CREATE DATABASE zingo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'zingo'@'%' IDENTIFIED BY 'zingo';
GRANT ALL PRIVILEGES ON zingo.* TO 'zingo'@'%';
FLUSH PRIVILEGES;
```

3. (Optional) Ruleaza schema manual:

```bash
mysql -u zingo -p zingo < backend/schema.sql
```

Aplicatia creeaza tabela automat la start, deci schema.sql este optional.

## 2) Configurare

Foloseste fisier `.env` in `backend/` (nu mai ai nevoie de `export`).
Poti copia din `.env.example` si apoi edita valorile.

Local MySQL:
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=zingo
DB_USER=zingo
DB_PASS=zingo
```

Remote MySQL:
```
DB_HOST=your-remote-host
DB_PORT=3306
DB_NAME=zingo
DB_USER=remote_user
DB_PASS=remote_pass
```

Optional: poti folosi un URL complet (are prioritate fata de host/port/nume):
```
DB_URL=jdbc:mysql://your-remote-host:3306/zingo?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC
```

## 3) Rulare

```bash
cd backend
./gradlew run
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

## 6) Raspuns asteptat

```json
{
  "id": "uuid",
  "username": "mihai",
  "email": "mihai@example.com",
  "phone": null,
  "birthDate": "2000-01-01"
}
```
