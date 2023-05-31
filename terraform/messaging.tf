# -- SQS --
// This is mapped from the Terraform infrastructure defined in the
// podaac/swodlr-api repo
data "aws_sqs_queue" "async_update" {
  name = "${local.app_prefix}-async-update-queue"
}

# -- Event Mapping --
resource "aws_lambda_event_source_mapping" "async_update_lambda" {
  event_source_arn = data.aws_sqs_queue.async_update.arn
  function_name = aws_lambda_function.main.arn
}
