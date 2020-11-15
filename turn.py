import stack as st
import shuffler as sh
import companies as cp
import players as ps


def buyStock(pnum):
    print("\nYour Portfolio is:(share prices)\n")
    print(f"{ps.playerList[pnum].vfstock} shares of {st.companyNames[0]}")
    print(f"{ps.playerList[pnum].ybstock} shares of {st.companyNames[1]}")
    print(f"{ps.playerList[pnum].crdstock} shares of {st.companyNames[2]}")
    print(f"{ps.playerList[pnum].tcsstock} shares of {st.companyNames[3]}")
    print(f"{ps.playerList[pnum].relstock} shares of {st.companyNames[4]}")
    print(f"{ps.playerList[pnum].infstock} shares of {st.companyNames[5]}\n")
    # for i in range(6):
    #     print(f"{mn.playerList[pnum].stonk[i]} shares of {st.companyNames[i]}")

    print(f"Your balance is: {ps.playerList[pnum].cash}\n")

    comp = int(input("Enter the number of the company you want to buy:"))

    if not cp.companyList[comp - 1].open:
        print(f"{st.companyNames[comp - 1]} is closed. Try some other company")
        buyStock(pnum)

    if cp.companyList[comp - 1].open:
        print(f"\nThe number of available stock is {ps.stlist[comp - 1]}")

        aukat = int(ps.playerList[pnum].cash / cp.companyList[comp - 1].value)
        print(f"You can buy {aukat} shares of {cp.companyList[comp - 1].name}\n")

        number = int(input("Enter the number of shares you want:"))

        if number > ps.stlist[comp - 1]:
            print("The number of stocks you want to purchase are not available")
            buyStock(pnum)

        if number > aukat:
            print(f"You don't have enough balance to buy {number} shares")
            buyStock(pnum)

        if number <= aukat:
            if number <= ps.stlist[comp - 1]:
                if comp == 1:
                    ps.playerList[pnum].vfstock += number

                if comp == 2:
                    ps.playerList[pnum].ybstock += number

                if comp == 3:
                    ps.playerList[pnum].crdstock += number

                if comp == 4:
                    ps.playerList[pnum].tcsstock += number

                if comp == 5:
                    ps.playerList[pnum].relstock += number

                if comp == 6:
                    ps.playerList[pnum].infstock += number
                # print(mn.playerList[pnum].number)
                # mn.playerList[pnum].stonk[comp - 1] += number
                ps.stlist[comp - 1] -= number
                cost = cp.companyList[comp - 1].value * number
                ps.playerList[pnum].cash -= cost

                print(f"Your total cost for the purchase is -  {cost}")
                print(f"Your remaining balance is - {ps.playerList[pnum].cash}")

                print("\nYour Portfolio is:\n")

                print(f"{ps.playerList[pnum].vfstock} shares of {st.companyNames[0]}")
                print(f"{ps.playerList[pnum].ybstock} shares of {st.companyNames[1]}")
                print(f"{ps.playerList[pnum].crdstock} shares of {st.companyNames[2]}")
                print(f"{ps.playerList[pnum].tcsstock} shares of {st.companyNames[3]}")
                print(f"{ps.playerList[pnum].relstock} shares of {st.companyNames[4]}")
                print(f"{ps.playerList[pnum].infstock} shares of {st.companyNames[5]}\n")
                # for i in range(6):
                #     print(f"{mn.playerList[pnum].stonk[i]} shares of {st.companyNames[i]}")

                print("your transaction has been completed successfully.\n")
                input("Press any key to continue.")


def sellStock(pnum):
    hold = 0
    print("\nYour Portfolio is:\n")

    print(f"{ps.playerList[pnum].vfstock} shares of {st.companyNames[0]}")
    print(f"{ps.playerList[pnum].ybstock} shares of {st.companyNames[1]}")
    print(f"{ps.playerList[pnum].crdstock} shares of {st.companyNames[2]}")
    print(f"{ps.playerList[pnum].tcsstock} shares of {st.companyNames[3]}")
    print(f"{ps.playerList[pnum].relstock} shares of {st.companyNames[4]}")
    print(f"{ps.playerList[pnum].infstock} shares of {st.companyNames[5]}\n")
    print(f"Your balance is: {ps.playerList[pnum].cash}")
    comp = int(input("Enter the number of the company you want to sell:"))
    if comp == 1:
        hold = ps.playerList[pnum].vfstock

    if comp == 2:
        hold = ps.playerList[pnum].ybstock

    if comp == 3:
        hold = ps.playerList[pnum].crdstock

    if comp == 4:
        hold = ps.playerList[pnum].tcsstock

    if comp == 5:
        hold = ps.playerList[pnum].relstock

    if comp == 6:
        hold = ps.playerList[pnum].infstock

    print(f"You have {hold} shares of {st.companyNames[comp - 1]} to sell.")
    number = int(input("Enter the number of shares you want to sell:"))

    if number > hold:
        print(f"You don't own {number} shares of {st.companyNames[comp - 1]}")
        sellStock(pnum)

    if number <= hold:
        if comp == 1:
            ps.playerList[pnum].vfstock -= number

        if comp == 2:
            ps.playerList[pnum].ybstock -= number

        if comp == 3:
            ps.playerList[pnum].crdstock -= number

        if comp == 4:
            ps.playerList[pnum].tcsstock -= number

        if comp == 5:
            ps.playerList[pnum].relstock -= number

        if comp == 6:
            ps.playerList[pnum].infstock -= number

        ps.stlist[comp - 1] += number
        amount = cp.companyList[comp - 1].value * number
        ps.playerList[pnum].cash += amount
        print(f"Your total revenue from the sale is -  {amount}")
        print(f"Your remaining balance is - {ps.playerList[pnum].cash}")

        print("\nYour Portfolio is:\n")
        print(f"{ps.playerList[pnum].vfstock} shares of {st.companyNames[0]}")
        print(f"{ps.playerList[pnum].ybstock} shares of {st.companyNames[1]}")
        print(f"{ps.playerList[pnum].crdstock} shares of {st.companyNames[2]}")
        print(f"{ps.playerList[pnum].tcsstock} shares of {st.companyNames[3]}")
        print(f"{ps.playerList[pnum].relstock} shares of {st.companyNames[4]}")
        print(f"{ps.playerList[pnum].infstock} shares of {st.companyNames[5]}")
        print("your transaction has been completed successfully.")
        input("Press any key to continue.")


def rightsbuy(comp, pnum, holdings, eligibleplayers):
    availableShares = ps.stlist[comp - 1]
    print(f"\nPlayer {pnum}'s turn to buy for rights issue.")
    print(f"You own {holdings} shares of {st.companyNames[comp - 1]}")
    print(f"The number of shares available in the market are {availableShares}")
    if (holdings/2) <= availableShares:
        print(f"You are eligible to buy {holdings/2} shares at rate{cp.companyList[comp -1].value}")
    if (holdings/2) > availableShares:
        print(f"You are eligible to buy{holdings/2} shares but can only buy {availableShares} due to availability")
    number = int(input("Enter the number of shares you want:"))
    if number > availableShares:
        print(f"only {availableShares} shares are available. Try again.")
        rightsbuy(comp, pnum, holdings)
    if number > (holdings/2):
        print(f"You are not eligible for {number} shares. Try again.")
        rightsbuy()
    if number <= int(holdings/2):
        if number <= availableShares:
            return number


def rightsIssue(pnum):
    global check
    for anycard in ps.playerList[pnum].hand:
        if anycard.companyName == st.powerCards[0]:
            check = True
            break
        if anycard.companyName != st.powerCards[0]:
            check = False

    if not check:
        print("You don't have a right's issue.")

    if check:
        comp = int(input("Enter the company number to use it on:"))

        rightsValue = 10
        preValue = cp.companyList[comp - 1].value
        cp.companyList[comp - 1].value = rightsValue

        speciallist = []
        for players in ps.playerList[pnum:]:
            speciallist.append(players)
        for players in ps.playerList[:pnum]:
            speciallist.append(players)

        for eligibleplayers in speciallist:
            pnum = eligibleplayers.number
            if comp == 1:
                if eligibleplayers.vfstock > 0:
                    holdings = eligibleplayers.vfstock
                    eligibleplayers.vfstock += rightsbuy(comp, pnum, holdings, eligibleplayers)

            if comp == 2:
                if eligibleplayers.ybstock > 0:
                    holdings = eligibleplayers.ybstock
                    eligibleplayers.ybstock += rightsbuy(comp, pnum, holdings, eligibleplayers)

            if comp == 3:
                if eligibleplayers.crdstock > 0:
                    holdings = eligibleplayers.crdstock
                    eligibleplayers.crdstock += rightsbuy(comp, pnum, holdings, eligibleplayers)

            if comp == 4:
                if eligibleplayers.tcsstock > 0:
                    holdings = eligibleplayers.tcsstock
                    eligibleplayers.tcsstock += rightsbuy(comp, pnum, holdings, eligibleplayers)

            if comp == 5:
                if eligibleplayers.relstock > 0:
                    holdings = eligibleplayers.relstock
                    eligibleplayers.relstock += rightsbuy(comp, pnum, holdings, eligibleplayers)

            if comp == 6:
                if eligibleplayers.infstock > 0:
                    holdings = eligibleplayers.infstock
                    eligibleplayers.infstock += rightsbuy(comp, pnum, holdings, eligibleplayers)

        cp.companyList[comp - 1].value = preValue


def currencysettlement():
    for everyplayer in ps.playerList:
        for everycard in everyplayer.hand:

            if everycard.companyName == st.powerCards[4]:
                print(f"\n\nPlayer {everyplayer.number}:")
                print(f'\n{everyplayer.cash} before')
                everyplayer.cash += 0.1 * everyplayer.cash
                print(f'{everyplayer.cash} after')

            if everycard.companyName == st.powerCards[5]:
                print(f"\n\nPlayer {everyplayer.number}:")
                print(f'\n{everyplayer.cash} before')
                everyplayer.cash -= 0.1 * everyplayer.cash
                print(f'{everyplayer.cash} after')


def debenture(pnum):
    possession = False
    for stuff in ps.playerList[pnum].hand:
        if stuff.companyName == 'Debenture':
            possession = True
    if possession:
        comp = int(input("Enter the number of company you want to open:"))
        if cp.companyList[comp - 1].open:
            print("The company is already open")
        if not cp.companyList[comp - 1].open:
            cp.companyList[comp - 1].value = cp.values[comp - 1]
            cp.companyList[comp - 1].open = True
    if not possession:
        print("You don't have a Debenture.")


def shareSuspend():
    for allplayers in ps.playerList:
        for allcards in allplayers.hand:
            if allcards.companyName == st.powerCards[1]:
                print(f"Player {allplayers.number} has a {st.powerCards[1]}")
                print("Press 0 to pass and not use the card")
                comp = int(input("Enter the company you want to hit it on:"))
                if comp == 0:
                    continue
                doublesuspend = cp.companyList[comp - 1].value
                cp.companyList[comp - 1].value = cp.prevlist[comp - 1]
                cp.prevlist.remove(cp.prevlist[comp - 1])
                cp.prevlist.insert(comp - 1, doublesuspend)

    for companies in cp.companyList:
        if companies.value > 0:
            companies.open = True
    cp.prevlist.clear()

# def buyStock():

#     comp = input("Enter the number of the company you want to buy#     stock.name = cp.companyList[int(comp)].name
#     stock.value = cp.companyList[int(comp)].value
#     number = input("the number of stocks you want:")
#     start = 200 * int(comp)
#     for buying in range(int(start), int(start) + int(number)):
#         stockList[buying].available = False
#         mn.p1.stocks.append(stockList[buying])
#     cost = stock.value * int(number) * 1000
#     print(f"\n\nYour total cost for this purchase is {cost}")
#     print(f"\n\nYour stock holdings are: {stock.name} * {number} shares.\n")
