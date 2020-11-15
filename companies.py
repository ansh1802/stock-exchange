import stack as st
import players as ps


class Company:
    name = ''
    value = 0
    open = True

    def printvalues(self):
        print(f"{self.name} {self.value}")


values = [20, 25, 40, 55, 75, 80]
companyList = []
prevlist = []

for i in range(6):
    company = Company()
    company.name = st.companyNames[i]
    company.value = values[i]
    companyList.append(company)


def fluctuatevalues():

    for everycompany in range(6):
        prevlist.append(companyList[everycompany].value)
    for lol in ps.playerList:
        for every in lol.hand:
            for i in range(6):
                if companyList[i].open:
                    if every.companyName == st.companyNames[i]:
                        if every.positive:
                            companyList[i].value += every.companyValue
                        if not every.positive:
                            companyList[i].value -= every.companyValue

    for i in range(6):
        if companyList[i].value <= 0:
            companyList[i].value = 0
            companyList[i].open = False


def printingallvalues():
    print("\n\nThe company values stand at:")
    for num in companyList:
        num.printvalues()
    print("PREV:")
    for num in prevlist:
        print(num)



#printingallvalues()
