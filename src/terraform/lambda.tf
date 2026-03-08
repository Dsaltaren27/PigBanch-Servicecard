resource "aws_lambda_function" "CardActivateLmb" {
  filename      = "placeholder.zip"
  function_name = var.card_activate_lambda_name
  role          = "arn:aws:iam::191411384015:role/placeholder"
  handler       = "handler.handler"
  runtime       = "nodejs20.x"
}

resource "aws_lambda_function" "CardPaidCreditCardLmb" {
  filename      = "placeholder.zip"
  function_name = var.card_paid_lambda_name
  role          = "arn:aws:iam::191411384015:role/placeholder"
  handler       = "handler.handler"
  runtime       = "nodejs20.x"
}

resource "aws_lambda_function" "CardGetReportLmb" {
  filename      = "placeholder.zip"
  function_name = var.card_get_report_lambda_name
  role          = "arn:aws:iam::191411384015:role/placeholder"
  handler       = "handler.handler"
  runtime       = "nodejs20.x"
}

resource "aws_lambda_function" "CardPurchaseLmb" {
  filename      = "placeholder.zip"
  function_name = var.card_purchase_lambda_name
  role          = "arn:aws:iam::191411384015:role/placeholder"
  handler       = "handler.handler"
  runtime       = "nodejs20.x"
}

resource "aws_lambda_function" "CardTransactionSaveLmb" {
  filename      = "placeholder.zip"
  function_name = var.card_transaction_save_lambda_name
  role          = "arn:aws:iam::191411384015:role/placeholder"
  handler       = "handler.handler"
  runtime       = "nodejs20.x"
}