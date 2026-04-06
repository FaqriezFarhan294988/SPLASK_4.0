import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'splask_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Initialize database tables on startup
export const initDatabase = async () => {
  try {
    const connection = await pool.getConnection();

    // Create websites table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS websites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL UNIQUE,
        serp_api_token VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create scan_results table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS scan_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT NOT NULL,
        total_score DECIMAL(5, 2),
        accessibility_score DECIMAL(5, 2),
        ease_of_use_score DECIMAL(5, 2),
        content_quality_score DECIMAL(5, 2),
        security_score DECIMAL(5, 2),
        responsiveness_score DECIMAL(5, 2),
        reliability_score DECIMAL(5, 2),
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        INDEX idx_website (website_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create rule_results table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rule_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scan_result_id INT NOT NULL,
        rule_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        score DECIMAL(5, 2),
        message LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scan_result_id) REFERENCES scan_results(id) ON DELETE CASCADE,
        INDEX idx_scan (scan_result_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create contact_messages table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        message LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    connection.release();
    console.log('✓ Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('✗ Database initialization error:', error.message);
    throw error;
  }
};

// Test connection
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✓ Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    throw error;
  }
};

// Recover stale scans that were interrupted by server restarts.
export const recoverProcessingScans = async () => {
  const connection = await pool.getConnection();

  try {
    const [result] = await connection.execute(
      "UPDATE scan_results SET status = 'FAILED' WHERE status = 'PROCESSING'"
    );

    if (result.affectedRows > 0) {
      console.log(`✓ Recovered ${result.affectedRows} stale scan(s) from PROCESSING to FAILED`);
    }
  } catch (error) {
    console.error('✗ Failed to recover stale scans:', error.message);
    throw error;
  } finally {
    connection.release();
  }
};

export default pool;