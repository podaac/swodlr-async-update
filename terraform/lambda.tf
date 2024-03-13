resource "aws_lambda_function" "main" {
  function_name = "${local.service_prefix}-main"
  handler = "lib/index.lambdaHandler"

  role = aws_iam_role.lambda.arn
  runtime = "nodejs18.x"

  filename = "${path.module}/../dist/${local.name}-${local.version}.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/${local.name}-${local.version}.zip")

  vpc_config {
    security_group_ids = [data.aws_security_group.database.id]
    subnet_ids = [for k, v in data.aws_subnet.private : v.id]
  }
}

# -- IAM --
resource "aws_iam_policy" "ssm_parameters_read" {
  name_prefix = "SSMParametersReadOnlyAccess"
  path = "${local.service_path}/"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid = ""
      Action = [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ]
      Effect   = "Allow"
      Resource = "arn:aws:ssm:${var.region}:${local.account_id}:parameter${local.service_path}/*"
    }]
  })
}

resource "aws_iam_role" "lambda" {
  name_prefix = "main"
  path = "${local.service_path}/"

  permissions_boundary = "arn:aws:iam::${local.account_id}:policy/NGAPShRoleBoundary"
  managed_policy_arns = [
    "arn:aws:iam::${local.account_id}:policy/NGAPProtAppInstanceMinimalPolicy",
    "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
    aws_iam_policy.ssm_parameters_read.arn
  ]

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  inline_policy {
    name = "AsyncUpdatePolicy"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Sid = ""
          Action = [
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes"
          ]
          Effect   = "Allow"
          Resource = data.aws_sqs_queue.async_update.arn
        }
      ]
    })
  }
}

# -- SSM Parameters --
resource "aws_ssm_parameter" "db_host" {
  name = "${local.service_path}/db_host"
  type = "String"
  value = data.aws_db_instance.database.address
}

resource "aws_ssm_parameter" "db_name" {
  name = "${local.service_path}/db_name"
  type = "String"
  value = data.aws_ssm_parameter.db_name.value
}

resource "aws_ssm_parameter" "db_username" {
  name = "${local.service_path}/db_username"
  type = "String"
  value = data.aws_ssm_parameter.db_app_username.value
}

resource "aws_ssm_parameter" "db_password" {
  name = "${local.service_path}/db_password"
  type = "SecureString"
  value = data.aws_ssm_parameter.db_app_password.value
}

resource "aws_ssm_parameter" "log_level" {
  name = "${local.service_path}/log_level"
  type = "String"
  value = var.log_level
}
