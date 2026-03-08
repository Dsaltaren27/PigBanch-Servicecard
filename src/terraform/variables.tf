variable "stage" {
  type    = string
  default = "dev"
}

variable "card_activate_lambda_name" {
  type    = string
  default = "card-activate-lambda"
}

variable "card_paid_lambda_name" {
  type    = string
  default = "card-paid-credit-card-lambda"
}

variable "card_get_report_lambda_name" {
  type    = string
  default = "card-get-report-lambda"
}

variable "card_purchase_lambda_name" {
  type    = string
  default = "card-purchase-lambda"
}

variable "card_transaction_save_lambda_name" {
  type    = string
  default = "card-transaction-save-lambda"
}