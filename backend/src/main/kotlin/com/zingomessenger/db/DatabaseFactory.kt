package com.zingomessenger.db

import com.zingomessenger.config.Env
import com.zingomessenger.db.tables.Users
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction

object DatabaseFactory {
    fun init() {
        val dataSource = hikari()
        Database.connect(dataSource)

        transaction {
            SchemaUtils.create(Users)
        }
    }

    private fun hikari(): HikariDataSource {
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
}
