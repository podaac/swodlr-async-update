variable "app_name" {
    default = "swodlr"
    type = string
}

variable "service_name" {
    default = "async-update"
    type = string
}

variable "default_tags" {
    type = map(string)
    default = {}
}

variable "stage" {
    type = string
}

variable "region" {
    type = string
}

variable "log_level" {
    type = string
    default = "INFO"
}
