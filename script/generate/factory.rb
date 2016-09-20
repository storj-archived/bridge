DEBITS_PER_CREDIT = 5

def random_date_between_months_ago(min_months_ago, max_months_ago)
  random_days = Random.rand(
    (min_months_ago * 30 * 24 * 60)..(max_months_ago * 30 * 24 * 60)
  ) / 60.0 / 24.0
  DateTime.now - random_days
end

def dates_per_month(index, per_month)
  months_ago = index/per_month
  random_date_between_months_ago(months_ago, (months_ago + 1))
end

def debit_total_per_month(index, per_month)
  min_months_ago = index/per_month
  max_months_ago = min_months_ago + 1
  now = DateTime.now
  range_start = DateTime.new(now.year, now.month) - max_months_ago.months
  range_end = DateTime.new(now.year, now.month) - min_months_ago.months
  range = range_start..range_end
  Debit.between(created: range).map(&:amount).reduce :+
end

class User
  include Mongoid::Document
  embeds_many :payment_processors, store_as: :paymentProcessors
  has_many :credits
  has_many :debits

  field :hashpass, type: String
  field :created, type: DateTime
  field :activated, type: Boolean
end

class PaymentProcessor
  include Mongoid::Document
  embedded_in :user

  field :name, type: String
  field :default, type: Boolean
  field :created, type: DateTime
  field :rawData, type: Array
end

class Credit
  include Mongoid::Document
  belongs_to :_user, class_name: 'User', foreign_key: :user

  field :paid_amount, type: Integer
  field :invoiced_amount, type: Integer
  field :promo_code, type: String
  field :promo_amount, type: Integer
  field :created, type: DateTime
  field :type, type: String
  field :paid, type: Boolean
end

class Debit
  include Mongoid::Document
  belongs_to :_user, class_name: 'User', foreign_key: :user

  field :amount, type: Integer
  field :created, type: DateTime
  field :type, type: String
end

FactoryGirl.define do
  sequence :_id do |n|
    "user#{n}@example.com"
  end

  sequence :credit_index do |n|
    n
  end
  sequence :debit_index do |n|
    n
  end

  sequence :audit? do
    Random.rand(0..1) < 1 #1:1 audit:transfer
  end


  sequence :automatic? do
    Random.rand(1..5) < 5 #1:5 manual:automatic
  end

  factory :credit do
    transient { credit_index }
    transient { automatic? }
    created { dates_per_month(credit_index, 1) }
    invoiced_amount { debit_total_per_month(credit_index, 1) }
    paid_amount { invoiced_amount }
    paid true
    promo_amount 0
    promo_code nil
    type do
      if  credit_index == 1 #first payment is always manual
        'manual'
      else
        automatic? ? 'automatic' : 'manual'
      end
    end
    _user
  end

  factory :debit do
    transient { debit_index }
    transient { audit? }
    created { dates_per_month(debit_index, 5) }
    amount { audit? ? Random.rand(1..500) : Random.rand(10..1000) }
    type { audit? ? 'audit' : 'transfer' }
    _user
  end

  factory :payment_processor do
    name :stripe
    default true
    created DateTime.now - 365
    rawData { [stripe_data] }
  end

  factory :user, aliases: [:_user] do
    _id
    hashpass '3f432dff8834d517de9ed5428bad0df117b30894bff4eed4d2d515e4bc48bc7f' #badpassword
    activated true
    created DateTime.now - 365 #1 year ago
    transient { credits_count 5 }
    transient { debits_count (5 * (DEBITS_PER_CREDIT + 1)) }
    payment_processors { build_list(:payment_processor, 1) }
    after(:create) do |user, evaluator|
      debits = create_list(:debit, evaluator.debits_count, _user: user)
      credits = create_list(:credit, evaluator.credits_count, _user: user)
    end
  end
end

def stripe_data
JSON.parse %q(
    {
        "billingDate" : 2,
        "customer" : {
            "subscriptions" : {
                "url" : "/v1/customers/cus_97YiKPOYvPQ8Ha/subscriptions",
                "total_count" : 1,
                "has_more" : false,
                "data" : [
                    {
                        "trial_start" : null,
                        "trial_end" : null,
                        "tax_percent" : null,
                        "status" : "active",
                        "start" : 1472830106,
                        "quantity" : 1,
                        "plan" : {
                            "trial_period_days" : null,
                            "statement_descriptor" : "Storj.io account usage",
                            "name" : "premium",
                            "livemode" : false,
                            "interval_count" : 1,
                            "interval" : "month",
                            "currency" : "usd",
                            "created" : 1472738058,
                            "amount" : 0,
                            "object" : "plan",
                            "id" : "premium"
                        },
                        "livemode" : false,
                        "ended_at" : null,
                        "discount" : null,
                        "customer" : "cus_97YiKPOYvPQ8Ha",
                        "current_period_start" : 1472830106,
                        "current_period_end" : 1475422106,
                        "created" : 1472830106,
                        "canceled_at" : null,
                        "cancel_at_period_end" : false,
                        "application_fee_percent" : null,
                        "object" : "subscription",
                        "id" : "sub_97Yi6fsBzeDW6C"
                    }
                ],
                "object" : "list"
            },
            "sources" : {
                "url" : "/v1/customers/cus_97YiKPOYvPQ8Ha/sources",
                "total_count" : 1,
                "has_more" : false,
                "data" : [
                    {
                        "tokenization_method" : null,
                        "name" : null,
                        "last4" : "4242",
                        "funding" : "credit",
                        "fingerprint" : "DbXmpVpiNsp7lcnp",
                        "exp_year" : 2019,
                        "exp_month" : 9,
                        "dynamic_last4" : null,
                        "cvc_check" : "pass",
                        "customer" : "cus_97YiKPOYvPQ8Ha",
                        "country" : "US",
                        "brand" : "Visa",
                        "address_zip_check" : null,
                        "address_zip" : null,
                        "address_state" : null,
                        "address_line2" : null,
                        "address_line1_check" : null,
                        "address_line1" : null,
                        "address_country" : null,
                        "address_city" : null,
                        "object" : "card",
                        "id" : "card_18pJafHUqQsjaswpAm1uLT8b"
                    }
                ],
                "object" : "list"
            },
            "shipping" : null,
            "livemode" : false,
            "email" : "user1@example.com",
            "discount" : null,
            "description" : null,
            "delinquent" : false,
            "default_source" : "card_18pJafHUqQsjaswpAm1uLT8b",
            "currency" : "usd",
            "created" : 1472830106,
            "account_balance" : 0,
            "object" : "customer",
            "id" : "cus_97YiKPOYvPQ8Ha"
        }
    }
)
end
