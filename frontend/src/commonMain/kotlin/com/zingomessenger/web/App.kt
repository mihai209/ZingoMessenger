package com.zingomessenger.web

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val AppColors = darkColorScheme(
    primary = Color(0xFF00D4B5),
    secondary = Color(0xFFF6C945),
    background = Color(0xFF0B0D12),
    surface = Color(0xFF161A22),
    onPrimary = Color(0xFF0B0D12),
    onSurface = Color(0xFFF5F7FF)
)

@Composable
fun App() {
    MaterialTheme(colorScheme = AppColors) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(24.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Header()
                Spacer(Modifier.height(24.dp))
                AuthGrid()
            }
        }
    }
}

@Composable
private fun Header() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .background(MaterialTheme.colorScheme.primary),
            contentAlignment = Alignment.Center
        ) {
            Text("Z", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimary)
        }
        Spacer(Modifier.width(16.dp))
        Column {
            Text("ZingoMessenger", style = MaterialTheme.typography.headlineSmall)
            Text(
                "Encrypted chat. First step: auth UI in Kotlin.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
        }
    }
    Spacer(Modifier.height(12.dp))
    Text(
        "API Base: ${EnvConfig.API_BASE}",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
    )
}

@Composable
private fun AuthGrid() {
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isNarrow = maxWidth < 900.dp
        if (isNarrow) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                RegisterCard()
                LoginCard()
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(modifier = Modifier.weight(1f)) { RegisterCard() }
                Box(modifier = Modifier.weight(1f)) { LoginCard() }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RegisterCard() {
    val username = remember { mutableStateOf("") }
    val email = remember { mutableStateOf("") }
    val phone = remember { mutableStateOf("") }
    val password = remember { mutableStateOf("") }
    val passwordConfirm = remember { mutableStateOf("") }
    val birthDate = remember { mutableStateOf("") }
    val status = remember { mutableStateOf("") }

    Card {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Register", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)

            TextField("Username", username)
            TextField("Email", email)
            TextField("Phone", phone)
            TextField("Password", password)
            TextField("Confirm Password", passwordConfirm)
            TextField("Birth date (YYYY-MM-DD)", birthDate)

            Button(onClick = {
                status.value = "Register UI ready. Wire API next."
            }, modifier = Modifier.fillMaxWidth()) {
                Text("Create account")
            }

            if (status.value.isNotBlank()) {
                Text(
                    status.value,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.secondary
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LoginCard() {
    val identifier = remember { mutableStateOf("") }
    val password = remember { mutableStateOf("") }
    val status = remember { mutableStateOf("") }

    Card {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Login", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)

            TextField("Username / Email / Phone", identifier)
            TextField("Password", password)

            Button(onClick = {
                status.value = "Login UI ready. Wire API next."
            }, modifier = Modifier.fillMaxWidth()) {
                Text("Sign in")
            }

            if (status.value.isNotBlank()) {
                Text(
                    status.value,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.secondary
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TextField(label: String, state: MutableState<String>) {
    OutlinedTextField(
        value = state.value,
        onValueChange = { state.value = it },
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth()
    )
}
