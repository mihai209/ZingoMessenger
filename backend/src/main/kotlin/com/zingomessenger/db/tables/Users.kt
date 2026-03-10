package com.zingomessenger.db.tables

import org.jetbrains.exposed.dao.id.UUIDTable
import org.jetbrains.exposed.sql.javatime.date
import org.jetbrains.exposed.sql.javatime.datetime

object Users : UUIDTable("users") {
    val username = varchar("username", 32).uniqueIndex()
    val email = varchar("email", 255).nullable().uniqueIndex()
    val phone = varchar("phone", 32).nullable().uniqueIndex()
    val passwordHash = varchar("password_hash", 100)
    val birthDate = date("birth_date")
    val createdAt = datetime("created_at")
}
