package com.zingomessenger.db.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.date
import org.jetbrains.exposed.sql.javatime.datetime

object Users : Table("users") {
    val id = varchar("id", 36)
    val username = varchar("username", 32).uniqueIndex()
    val email = varchar("email", 255).nullable().uniqueIndex()
    val phone = varchar("phone", 32).nullable().uniqueIndex()
    val passwordHash = varchar("password_hash", 100)
    val birthDate = date("birth_date")
    val createdAt = datetime("created_at")

    override val primaryKey = PrimaryKey(id)
}
