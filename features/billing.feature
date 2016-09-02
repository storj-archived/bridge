Feature: Billing

  Background: Ensure dev server isup
    Given the bridge server is running

  Scenario: Creating debits
    Given a user exists
    When an authorized agent POSTs to /debits
    Then a debit should be created
#    And an invoice item should be created in stripe

#  Scenario: Creating credits
#    Given valid debits for 1 billing cycle
#    When
