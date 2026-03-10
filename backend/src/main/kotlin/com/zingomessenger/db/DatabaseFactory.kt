package com.zingomessenger.db

import com.zingomessenger.config.Env
import com.zingomessenger.db.tables.Users
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import java.io.File

object DatabaseFactory {
    fun init() {
        val dataSource = hikari()
        Database.connect(dataSource)

        transaction {
            SchemaUtils.create(Users)
        }
    }

    private fun hikari(): HikariDataSource {
        val dbType = (Env.get("DB_TYPE", "sqlite") ?: "sqlite").lowercase()

        return if (dbType == "sqlite") {
            sqliteDataSource()
        } else {
            mysqlDataSource()
        }
    }

    private fun mysqlDataSource(): HikariDataSource {
        val host = Env.get("DB_HOST", "127.0.0.1")!!
        val port = Env.get("DB_PORT", "3306")!!
        val dbName = Env.get("DB_NAME", "zingo")!!
        val user = Env.get("DB_USER", "zingo")!!
        val pass = Env.get("DB_PASS", "zingo")!!

        val jdbcUrl = Env.get("DB_URL")
            ?: "jdbc:mysql://$host:$port/$dbName?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC"

        val config = HikariConfig().apply {
            setJdbcUrl(jdbcUrl)
            setUsername(user)
            setPassword(pass)
            driverClassName = "com.mysql.cj.jdbc.Driver"
            maximumPoolSize = 10
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_REPEATABLE_READ"
            validate()
        }

        return HikariDataSource(config)
    }

    private fun sqliteDataSource(): HikariDataSource {
        val sqlitePath = Env.get("DB_SQLITE_PATH", "./data/zingo.db")!!
        val jdbcUrl = Env.get("DB_URL") ?: "jdbc:sqlite:$sqlitePath"

        ensureSqliteDir(jdbcUrl)

        val config = HikariConfig().apply {
            setJdbcUrl(jdbcUrl)
            driverClassName = "org.sqlite.JDBC"
            maximumPoolSize = 1
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_SERIALIZABLE"
            validate()
        }

        return HikariDataSource(config)
    }

    private fun ensureSqliteDir(jdbcUrl: String) {
        val prefix = "jdbc:sqlite:"
        if (!jdbcUrl.startsWith(prefix)) return
        val rawPath = jdbcUrl.removePrefix(prefix)
        if (rawPath == ":memory:" || rawPath.isBlank()) return
        val file = File(rawPath)
        val parent = file.parentFile ?: return
        if (!parent.exists()) {
            parent.mkdirs()
        }
    }
}
