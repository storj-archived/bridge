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
  has_many :credits
  has_many :debits

  field :hashpass, type: String
  field :created, type: DateTime
  field :activated, type: Boolean
end

class Credit
  include Mongoid::Document
  belongs_to :_user, class_name: 'User', foreign_key: :user

  field :amount, type: Integer
  field :created, type: DateTime
  field :type, type: String
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
    amount { debit_total_per_month(credit_index, 1) }
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

  factory :user, aliases: [:_user] do
    _id
    hashpass '3f432dff8834d517de9ed5428bad0df117b30894bff4eed4d2d515e4bc48bc7f' #badpassword
    activated true
    created DateTime.now - 365 #1 year ago
    transient { credits_count 5 }
    transient { debits_count (5 * (DEBITS_PER_CREDIT + 1)) }
    after(:create) do |user, evaluator|
      debits = create_list(:debit, evaluator.debits_count, _user: user)
      credits = create_list(:credit, evaluator.credits_count, _user: user)
    end
  end
end

FactoryGirl.create :user
