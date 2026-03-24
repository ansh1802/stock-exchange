import shuffler as sh


class Player:
    hand = []
    number = 0
    stonk = [0, 0, 0, 0, 0, 0]
    vfstock = 0
    ybstock = 0
    crdstock = 0
    tcsstock = 0
    relstock = 0
    infstock = 0
    cash = 600


playerList = []
stlist = [200, 200, 200, 200, 200, 200]


p1 = Player()
p2 = Player()
p3 = Player()
p4 = Player()
p5 = Player()
p6 = Player()
playerList.append(p1)
playerList.append(p2)
playerList.append(p3)
playerList.append(p4)
playerList.append(p5)
playerList.append(p6)

playerNum = int(input("enter no. of players:"))

for num in range(6):
    playerList[num].number = num + 1

for skripop in range(6 - playerNum):
    playerList.pop()


def allotingcards():
    for num in range(playerNum):
        playerList[num].hand = sh.hands[num]


def printingplayercards():
    for num in playerList:
        print(f"\nplayer {num.number} cards are:\n")
        for numbers in num.hand:
            numbers.printcard()
