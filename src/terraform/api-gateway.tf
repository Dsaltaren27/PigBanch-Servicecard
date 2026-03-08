resource "aws_api_gateway_rest_api" "Api-Card"{
    name = "card-service-api"
    description= "Api para tarjetas en PIGBANCH"
}


#Card

resource "aws_api_gateway_resource" "Card" {
    rest_api_id = aws_api_gateway_rest_api.Api-Card.id
    parent_id = aws_api_gateway_rest_api.Api-Card.root_resource_id
    path_part = "card"
}

# /card/activate
resource "aws_api_gateway_resource" "CardActivate" {
    rest_api_id = aws_api_gateway_rest_api.Api-Card.id
    parent_id = aws_api_gateway_resource.Card.id
    path_part = "activate"
}


# /card/paid
resource "aws_api_gateway_resource" "CardPaid" {
    rest_api_id = aws_api_gateway_rest_api.Api-Card.id
    parent_id = aws_api_gateway_resource.Card.id
    path_part = "paid"
}
# /card/{card_id}
resource "aws_api_gateway_resource" "CardPaidById" {
    rest_api_id = aws_api_gateway_rest_api.Api-Card.id
    parent_id = aws_api_gateway_resource.CardPaid.id
    path_part = "{card_id}"
}

# /transactions
resource "aws_api_gateway_resource" "Transactions" {
    rest_api_id = aws_api_gateway_rest_api.Api-Card.id
    parent_id = aws_api_gateway_rest_api.Api-Card.root_resource_id
    path_part = "transactions"
}


# /transactions/purchase
resource "aws_api_gateway_resource" "TransactionsPurchase" {
    rest_api_id = aws_api_gateway_rest_api.Api-Card.id
    parent_id = aws_api_gateway_resource.Transactions.id
    path_part = "purchase"
}
# /transactions/save
resource "aws_api_gateway_resource" "TransactionsSave" {
  rest_api_id = aws_api_gateway_rest_api.Api-Card.id
  parent_id   = aws_api_gateway_resource.Transactions.id
  path_part   = "save"
}

# /transactions/save/{card_id}
resource "aws_api_gateway_resource" "TransactionsSaveById" {
  rest_api_id = aws_api_gateway_rest_api.Api-Card.id
  parent_id   = aws_api_gateway_resource.TransactionsSave.id
  path_part   = "{card_id}"
}

#METHODS

#POST/card/activate
resource "aws_api_gateway_method" "PostCardActivate" {
  rest_api_id   = aws_api_gateway_rest_api.Api-Card.id
  resource_id   = aws_api_gateway_resource.CardActivate.id
  http_method   = "POST"
  authorization = "NONE"
}
#POST/card/paid/{card_id}
resource "aws_api_gateway_method" "PostCardPaid" {
  rest_api_id   = aws_api_gateway_rest_api.Api-Card.id
  resource_id   = aws_api_gateway_resource.CardPaidById.id
  http_method   = "POST"
  authorization = "NONE"
}

#GET/card/{card_id}
resource "aws_api_gateway_method" "GetCardById" {
  rest_api_id   = aws_api_gateway_rest_api.Api-Card.id
 resource_id = aws_api_gateway_resource.CardPaidById.id
  http_method   = "GET"
  authorization = "NONE"
}

#POST/transactions/purchase
resource "aws_api_gateway_method" "PostTransactionsPurchase" {
  rest_api_id   = aws_api_gateway_rest_api.Api-Card.id
  resource_id   = aws_api_gateway_resource.TransactionsPurchase.id
  http_method   = "POST"
  authorization = "NONE"
}

#POST/transactions/save/{card_id}
resource "aws_api_gateway_method" "PostTransactionsSave" {
  rest_api_id   = aws_api_gateway_rest_api.Api-Card.id
  resource_id   = aws_api_gateway_resource.TransactionsSaveById.id
  http_method   = "POST"
  authorization = "NONE"
}

#INTEGRATIONS

resource "aws_api_gateway_integration" "IntegrationCardActivate" {
  rest_api_id             = aws_api_gateway_rest_api.Api-Card.id
  resource_id             = aws_api_gateway_resource.CardActivate.id
  http_method             = aws_api_gateway_method.PostCardActivate.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.CardActivateLmb.invoke_arn
}

resource "aws_api_gateway_integration" "IntegrationCardPaid" {
  rest_api_id             = aws_api_gateway_rest_api.Api-Card.id
  resource_id             = aws_api_gateway_resource.CardPaidById.id
  http_method             = aws_api_gateway_method.PostCardPaid.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.CardPaidCreditCardLmb.invoke_arn
}

resource "aws_api_gateway_integration" "IntegrationGetCard" {
  rest_api_id             = aws_api_gateway_rest_api.Api-Card.id
  resource_id = aws_api_gateway_resource.CardPaidById.id
  http_method             = aws_api_gateway_method.GetCardById.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.CardGetReportLmb.invoke_arn
}

resource "aws_api_gateway_integration" "IntegrationTransactionsPurchase" {
  rest_api_id             = aws_api_gateway_rest_api.Api-Card.id
  resource_id             = aws_api_gateway_resource.TransactionsPurchase.id
  http_method             = aws_api_gateway_method.PostTransactionsPurchase.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.CardPurchaseLmb.invoke_arn
}


resource "aws_api_gateway_integration" "IntegrationTransactionsSave" {
  rest_api_id             = aws_api_gateway_rest_api.Api-Card.id
  resource_id             = aws_api_gateway_resource.TransactionsSaveById.id
  http_method             = aws_api_gateway_method.PostTransactionsSave.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.CardTransactionSaveLmb.invoke_arn
}

#PERMISSIONS

resource "aws_lambda_permission" "AllowApiCardActivate" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.card_activate_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.Api-Card.execution_arn}/*/POST/card/activate"
  depends_on    = [aws_lambda_function.CardActivateLmb]
}

resource "aws_lambda_permission" "AllowApiCardPaid" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.card_paid_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.Api-Card.execution_arn}/*/POST/card/paid/*"
  depends_on    = [aws_lambda_function.CardPaidCreditCardLmb]
}

resource "aws_lambda_permission" "AllowApiGetCard" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.card_get_report_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.Api-Card.execution_arn}/*/GET/card/*"
  depends_on    = [aws_lambda_function.CardGetReportLmb]
}

resource "aws_lambda_permission" "AllowApiTransactionsPurchase" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.card_purchase_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.Api-Card.execution_arn}/*/POST/transactions/purchase"
  depends_on    = [aws_lambda_function.CardPurchaseLmb]
}

resource "aws_lambda_permission" "AllowApiTransactionsSave" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.card_transaction_save_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.Api-Card.execution_arn}/*/POST/transactions/save/*"
  depends_on    = [aws_lambda_function.CardTransactionSaveLmb]
}


# DEPLOYMENT Y STAGE

resource "aws_api_gateway_deployment" "CardApiDeployment" {
  rest_api_id = aws_api_gateway_rest_api.Api-Card.id
  depends_on = [
    aws_api_gateway_integration.IntegrationCardActivate,
    aws_api_gateway_integration.IntegrationCardPaid,
    aws_api_gateway_integration.IntegrationGetCard,
    aws_api_gateway_integration.IntegrationTransactionsPurchase,
    aws_api_gateway_integration.IntegrationTransactionsSave
  ]
}

resource "aws_api_gateway_stage" "CardApiStage" {
  deployment_id = aws_api_gateway_deployment.CardApiDeployment.id
  rest_api_id   = aws_api_gateway_rest_api.Api-Card.id
  stage_name    = var.stage
}


# OUTPUT - URL del API


output "cardApiUrl" {
  value = aws_api_gateway_stage.CardApiStage.invoke_url
}