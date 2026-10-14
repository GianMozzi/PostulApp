CREATE DATABASE IF NOT EXISTS postulapp;
USE postulapp;
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(160) NOT NULL UNIQUE,
  name VARCHAR(80) DEFAULT '',
  password_hash VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(120) NOT NULL,
  company VARCHAR(120) NOT NULL,
  location VARCHAR(120) DEFAULT '',
  modality ENUM('remote','hybrid','onsite') NOT NULL DEFAULT 'remote',
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status ENUM('wishlist','applied','interview','technical','offer','rejected') NOT NULL DEFAULT 'wishlist',
  experience ENUM('junior','semi','senior') NULL,
  technologies VARCHAR(200) NULL,
  language VARCHAR(40) NULL,
  applied_date DATE NULL,
  interview_date DATE NULL,
  contact VARCHAR(120) NULL,
  next_step VARCHAR(200) NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status)
);
