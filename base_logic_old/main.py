import shuffler as sh
import companies as cp
import stack as st
import turn as tr
import players as ps


for days in range(1, 11):
    print(f" \n\n DAY{days} ----- \n")

    sh.carddistribution()
    ps.allotingcards()
    ps.printingplayercards()

    for rounds in range(1):
        for turn in range(len(ps.playerList)):
            print(f"\nPlayer{ps.playerList[turn].number}'s turn (ROUND {rounds}):")
            print('''1.Buy\n2.Sell\n3.Pass\n4.Powercard''')
            choice = int(input("Enter the respective action number for your move:"))
            if choice == 1:
                tr.buyStock(turn)
            if choice == 2:
                tr.sellStock(turn)
            if choice == 3:
                continue
            if choice == 4:
                move = int(input("1.Rights Issue\n2.Loan Stock\n3.Debenture"))
                if move == 1:
                    tr.rightsIssue(turn)
                if move == 2:
                    print(ps.playerList[turn].cash)
                    ps.playerList[turn].cash += 100
                    print(ps.playerList[turn].cash)
                if move == 3:
                    tr.debenture(turn)
            else:
                continue

    cp.fluctuatevalues()
    cp.printingallvalues()
    input("Press any key to continue")
    tr.currencysettlement()
    input("Press any key to continue.")
    tr.shareSuspend()

    ps.playerList.append(ps.playerList[0])
    ps.playerList.remove(ps.playerList[0])


