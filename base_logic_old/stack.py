from colorama import Fore, Style


class Card(object):
    companyName = ""
    companyValue = 0
    positive = True
    checkpower = False
    in_bargain = False

    def printcard(self):
        if self.positive:
            if self.checkpower:
                print(Fore.BLUE + f"{self.companyName.upper()}" + Style.RESET_ALL)
            if not self.checkpower:
                print(Fore.GREEN + f"{self.companyName} +{self.companyValue}" + Style.RESET_ALL)
        if not self.positive:
            print(Fore.RED + f"{self.companyName} -{self.companyValue}" + Style.RESET_ALL)


cardStack = []
companyNames = ['Vodafone', 'YesBank', 'Cred', 'TCS', 'Reliance', 'Infosys']
powerCards = ['RightsIssue', 'ShareSuspend', 'LoanStock', 'Debenture', 'Currency + ', 'Currency - ']

for num in range(6):
    company = companyNames[num]
    for every in range(num+1):
        for sign in range(2):
            card = Card()
            if sign == 0:
                card.positive = True
            if sign == 1:
                card.positive = False
            value = (every+1) * 5
            card.companyName = str(company)
            card.companyValue = value
            cardStack.append(card)
            cardStack.append(card)
            #card.printcard()
            #card.printcard()

for num in powerCards:
    powerCard = Card()
    powerCard.companyName = num
    powerCard.checkpower = True
    if num == 'Currency + ':
        cardStack.append(powerCard)
        cardStack.append(powerCard)
    if num == 'Currency - ':
        cardStack.append(powerCard)
        cardStack.append(powerCard)
    cardStack.append(powerCard)
    cardStack.append(powerCard)
    #powerCard.printcard()
