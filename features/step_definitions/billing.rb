Given /^a user exists$/ do
  create :user
end

When /^an authorized agent POSTs to \/debits$/ do
  @body = {
      'user' => 'user1@example.com',
      'type' => 'transfer',
      'amount' => 1000
  }

  response = RestClient.post URLS[:debits], @body.to_json, content_type: 'application/json'
  @debit_id = JSON.parse(response.body)['debit']['_id']
end

Then /^a debit should be created$/ do
  Debit.find(@debit_id).attributes.should include(@body)
end