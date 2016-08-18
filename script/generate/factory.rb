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

def random_date
  DateTime.now - (Random.rand(1..720)/24.0) #sometime within the last 30 days
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

  sequence :created do
    random_date
  end

  sequence :audit? do
    Random.rand(0..1) < 1
  end


  sequence :automatic? do
    Random.rand(1..5) < 5 #1:5 manual:automatic
  end

  factory :credit do
    transient { automatic? } #1:1 audit:transfer
    amount { Random.rand(200..1500) }
    type { automatic? ? 'automatic' : 'manual' }
    created
    user
  end

  factory :debit do
    transient { audit? }
    amount { audit? ? Random.rand(1..500) : Random.rand(10..1000) }
    type { audit? ? 'audit' : 'transfer' }
    created
    user

    after() do |debit, evaluator|

    end
  end

  factory :user do
    _id
    hashpass '3f432dff8834d517de9ed5428bad0df117b30894bff4eed4d2d515e4bc48bc7f' #badpassword
    activated true
    created DateTime.now - 35 #35 days ago
    transient {credits_count 8}
    transient {debits_count 25}
    after(:create) do |user, evaluator|
      credits = create_list(:credit, evaluator.credits_count, user: user)
      debits = create_list(:debit, evaluator.debits_count, user: user)
    end
  end
end

FactoryGirl.create :user
