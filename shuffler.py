import stack
import random
from termcolor import colored

hands = []


def carddistribution():
    hands.clear()
    random.shuffle(stack.cardStack)

    #print("\n player 1 cards:\n")

    hand1 = random.sample(stack.cardStack, k=10)
    for everything in hand1:
        #everything.printcard()
        stack.cardStack.remove(everything)
    hands.append(hand1)
    #print("\n player 2 cards:\n")

    hand2 = random.sample(stack.cardStack, k=10)
    for everything in hand2:
        #everything.printcard()
        stack.cardStack.remove(everything)
    hands.append(hand2)

    hand3 = random.sample(stack.cardStack, k=10)
    for everything in hand3:
        #everything.printcard()
        stack.cardStack.remove(everything)
    hands.append(hand3)

    hand4 = random.sample(stack.cardStack, k=10)
    for everything in hand4:
        #everything.printcard()
        stack.cardStack.remove(everything)
    hands.append(hand4)

    hand5 = random.sample(stack.cardStack, k=10)
    for everything in hand5:
        #everything.printcard()
        stack.cardStack.remove(everything)
    hands.append(hand5)

    hand6 = random.sample(stack.cardStack, k=10)
    for everything in hand6:
        #everything.printcard()
        stack.cardStack.remove(everything)
    hands.append(hand6)

    for anything in hands:
        for i in anything:
            stack.cardStack.append(i)





