resource "aws_lambda_function" "main" {
  function_name = "${local.service_prefix}-main"
  handler = "lib.lambdaHandler"

  role = aws_iam_role.lambda.arn
  runtime = "nodejs18.x"

  filename = "${path.module}/../dist/${local.name}-${local.version}.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/${local.name}-${local.version}.zip")
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