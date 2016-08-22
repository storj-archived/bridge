require 'rubygems'
require 'bundler/setup'
require 'factory_girl'
require 'mongoid'
require 'database_cleaner'
require 'date'
include FactoryGirl

Mongoid.load!("#{__dir__}/mongoid.yml", :development)

DatabaseCleaner.strategy = :truncation
DatabaseCleaner.clean

DEBITS_PER_CREDIT = 5

def random_date_between_months_ago(min_months_ago, max_months_ago)
  random_days = Random.rand(
    (min_months_ago * 30 * 24 * 60)..(max_months_ago * 30 * 24 * 60)
  ) / 60.0 / 24.0
  DateTime.now - random_days
end

def dates_per_month(count, per_month)
  months_ago = count/per_month
  random_date_between_months_ago(months_ago, (months_ago + 1))
end

class User
  include Mongoid::Document
  has_many :credits
  has_many :debits

  field :hashpass, type: String
  field :created, type: DateTime
  field :activated, type: Boolean
end

class Credit
  include Mongoid::Document
  belongs_to :user

  field :amount, type: Integer
  field :created, type: DateTime
  field :type, type: String
end

class Debit
  include Mongoid::Document
  belongs_to :user

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
    transient { automatic? }
    amount { Random.rand(200..1500) }
    type { automatic? ? 'automatic' : 'manual' }
    transient { credit_index }
    created { dates_per_month(credit_index, 1) }
    user
  end

  factory :debit do
    transient { audit? }
    amount { audit? ? Random.rand(1..500) : Random.rand(10..1000) }
    type { audit? ? 'audit' : 'transfer' }
    transient { debit_index }
    created { dates_per_month(debit_index, 5) }
    user
  end

  factory :user do
    _id
    hashpass '3f432dff8834d517de9ed5428bad0df117b30894bff4eed4d2d515e4bc48bc7f' #badpassword
    activated true
    created DateTime.now - 365 #1 year ago
    transient { credits_count 5 }
    transient { debits_count (5 * (DEBITS_PER_CREDIT + 1)) }
    after(:create) do |user, evaluator|
      credits = create_list(:credit, evaluator.credits_count, user: user)
      debits = create_list(:debit, evaluator.debits_count, user: user)
    end
  end
end

FactoryGirl.create :user
