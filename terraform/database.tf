/* -- Database -- */
data "aws_db_instance" "database" {
  db_instance_identifier = "${local.app_prefix}-rds"
}

data "aws_ssm_parameter" "db_name" {
  name = "${local.app_path}/db-name"
}

/* -- Credentials -- */
data "aws_ssm_parameter" "db_app_username" {
  name = "${local.app_path}/db-app-username"
}

data "aws_ssm_parameter" "db_app_password" {
  name = "${local.app_path}/db-app-password"
  with_decryption = true
}
