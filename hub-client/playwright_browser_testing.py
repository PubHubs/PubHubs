from playwright.sync_api import sync_playwright, expect
from datetime import datetime 
import re
import random

DEFAULT_POLL_OPTIONS = 3
DEFAULT_ROOM = "new_room"
DEFAULT_TIMEOUT = 5000
state_location = "./hub-client/playwright_login_token.json"

def get_current_time(as_object=False):
    date = datetime.today()

    if as_object:
        return date
    else:
        return str(date)

def get_session(browser):
    context = browser.new_context()
    page = context.new_page()
    page.goto("http://localhost:8081/")
    page.wait_for_timeout(20000)
    page.reload()
    page.wait_for_timeout(1000)
    # store cookies and local storage
    storage = context.storage_state(path=state_location)
    context.close()
    return storage

def setup_room(browser, room_name):
    context = browser.new_context(storage_state=state_location)
    context.set_default_timeout(DEFAULT_TIMEOUT)
    page = context.new_page()
    page.goto("http://localhost:8081/")
    page.wait_for_timeout(1000)
    page.get_by_role("link", name=room_name).click()

    return page

def send_poll(page, no_options=DEFAULT_POLL_OPTIONS, multiple_choice=False):
    page.locator(".p-3 > div > .w-4\\/5 > .flex").get_by_role("button").first.click() # click attach button
    page.get_by_role("button", name="Poll").click() # click poll button

    # fill in fields
    curr_time = str(datetime.today()) # title is generated with current time stamp, so we can check if the poll we just made appeared (and not some other)
    page.get_by_role("textbox", name="Enter title...").fill("Title Poll " + curr_time) # fill title
    for i in range(0, no_options):
        page.get_by_role("textbox", name="Enter option...").nth(i).fill("Option " + str(i+1)) # fill option(s)
        page.get_by_role("textbox", name="Enter option...").nth(i).blur()
    page.get_by_role("textbox", name="Enter description...").fill("Description") # fill description

    if multiple_choice:
        page.locator(".ml-1 > div > div > .ml-auto").click()
        page.locator(".ml-3.mt-3 input#votingType").check()
        page.locator(".ml-3.mt-3 input#showVotes").check()
    else:
        page.locator(".ml-1 > div > div > .ml-auto").click()
        page.locator(".ml-3.mt-3 input#showVotes").check()

    # send poll
    page.get_by_text("Send").last.click()
    return curr_time

def send_scheduler(page, no_options=DEFAULT_POLL_OPTIONS):
    page.locator(".p-3 > div > .w-4\\/5 > .flex").get_by_role("button").first.click() # click attach button
    page.get_by_role("button", name="Scheduler", exact="True").click() # click scheduler button

    # fill in fields
    curr_time = str(datetime.today())

    page.get_by_role("textbox", name="Enter title...").fill("Title Scheduler " + curr_time) # fill title
    page.get_by_role("textbox", name="Enter location...").fill("Location") # fill title
    for i in range(0, no_options):
        page.get_by_role("button", name="+ Add option").click() # click add option
        date_menu = page.get_by_role("dialog")
        date_menu.get_by_label("Next month").click() # switch to next month for more day availability
        available_dates = date_menu.get_by_label("Calendar days").all_inner_texts()[0].split('\n')
        random.shuffle(available_dates)
        first_date = available_dates[0]
        second_date = available_dates[1]
        date_menu.get_by_label("Calendar days").get_by_text(first_date, exact=True).click()
        date_menu.get_by_label("Calendar days").get_by_text(second_date, exact=True).click()
        date_menu.get_by_role("button", name="Select").click() # submit option
    page.get_by_role("textbox", name="Enter description...").fill("Description") # fill description

    page.locator(".ml-1 > div > div > .ml-auto").click()
    page.locator(".ml-3.mt-3 input#showVotes").check()

    # send scheduler
    page.get_by_text("Send").last.click()
    return curr_time

def get_poll_votes(page, poll_locator):
    result = []
    poll_locator.get_by_role("button", name="View votes").click()
    popup_locator = page.locator(".mb-5")
    option_list = popup_locator.all_inner_texts()
    for o in option_list:
        result.append(int(o.split('\n')[1].split(' ')[0]))
    page.locator(".h-7").click()    # close votes screen
    return result   # list where index corresponds votes of that option

def get_scheduler_votes(page, scheduler_locator):
    result = []
    scheduler_locator.get_by_role("button", name="View votes").click()
    popup_locator = page.locator(".mb-5")
    option_list = popup_locator.all_inner_texts()  # [date \n time (\n profile pic)* \n Name \n ID \n votetime] * is optional
    for o in option_list:
        parsed = o.split('\n', 2)
        if len(parsed) > 2:
            vote_list = parsed[2].split(', ')  # [(profile pic \n)* Name \n ID \n votetime], we split it by vote based on the comma in votetime
            result.append(len(vote_list)-1)    # overcounts by 1
        else:
            result.append(0)
    page.locator(".h-7").click()    # close votes screen
    return result

def count_poll_options(poll_locator):
    return poll_locator.get_by_role("listitem").count()

def count_scheduler_options(scheduler_locator, picking=False):
    if picking:
        return scheduler_locator.get_by_role("list").locator(".grid").count()
    else:
        return scheduler_locator.get_by_role("list").locator(".rounded-lg").count()

def vote_poll(poll_locator, option_id):
    total_options = count_poll_options(poll_locator)
    assert option_id <= total_options, "Poll vote failure: Option is out of bounds."

    poll_locator.get_by_role("listitem").nth(option_id-1).click()
    return

def vote_scheduler(scheduler_locator, option_id, button):
    total_options = count_scheduler_options(scheduler_locator)
    assert option_id <= total_options, "Scheduler vote failure: Option is out of bounds."

    scheduler_locator.get_by_role("list").locator(".rounded-lg").nth(option_id-1).get_by_role("button").nth(button).click()
    return

# tries to find a clean poll and returns its locator
# if no clean poll is available, it creates one
def get_poll_locator(page, multiple_choice=False):
    try:
        expect(page.locator(".room-event").last).to_contain_text("Title Poll")
    except AssertionError:
        send_poll(page, multiple_choice=multiple_choice)

    poll_locator = page.locator(".room-event").filter(has_text="Title Poll").last
    return poll_locator

# tries to find a clean scheduler and returns its locator
# if no clean scheduler is available, it creates one
def get_scheduler_locator(page):
    try:
        expect(page.locator(".room-event").last).to_contain_text("Title Scheduler")
    except AssertionError:
        send_scheduler(page)

    scheduler_locator = page.locator(".room-event").filter(has_text="Title Scheduler").last
    return scheduler_locator

######################## TEST SUITE ########################
def test_ts1_create_single_choice_poll(page):
    # send poll
    creation_time = send_poll(page)
    # expect poll to appear in chat
    expect(page.locator(".room-event").last).to_contain_text(re.compile("Title Poll " + creation_time + "(?=.*)"))

def test_ts1_create_multiple_choice_poll(page):
    # send scheduler
    creation_time = send_poll(page, multiple_choice=True)
    # expect scheduler to appear in chat
    expect(page.locator(".room-event").last).to_contain_text(re.compile("Title Poll " + creation_time + "(?=.*)"))

def test_ts3_create_scheduler(page):
    # send scheduler
    creation_time = send_scheduler(page)
    # expect scheduler to appear in chat
    expect(page.locator(".room-event").last).to_contain_text(re.compile("Title Scheduler " + creation_time + "(?=.*)"))

# currently combines functionalities of TS5 and TS9
def test_ts5_vote(page):
    def test_case_1(page):
        poll_locator = get_poll_locator(page)
        total_options = count_poll_options(poll_locator)
        expected = [0 for _ in range(total_options)]
        # vote
        option_id = random.randint(1, total_options)
        vote_poll(poll_locator, option_id)
        # view votes
        votes = get_poll_votes(page, poll_locator)
        expected[option_id-1] += 1
        # check if votes are correctly registered
        assert votes == expected, "TS5-1: Incorrect vote results."

    def test_case_3(page, to_vote=2):
        poll_locator = get_poll_locator(page, multiple_choice=True)
        total_options = count_poll_options(poll_locator)
        assert total_options >= to_vote, "TS5-3: Cannot run due to insufficient poll options."
        expected = [0 for _ in range(total_options)]
        # "smart" way to pick random options to vote
        possible_ids = [i+1 for i in range(total_options)][:to_vote]
        random.shuffle(possible_ids)
        # vote
        for id in possible_ids:
            vote_poll(poll_locator, id)
            expected[id-1] += 1
        # view votes
        votes = get_poll_votes(page, poll_locator)
        # check if votes are correctly registered
        assert votes == expected, "TS5-3: Incorrect vote results."

    test_case_1(page)
    test_case_3(page)

def test_ts6_vote(page):
    scheduler_locator = get_scheduler_locator(page)
    total_options = count_scheduler_options(scheduler_locator)
    expected = [0 for _ in range(total_options)]
    # vote
    for option_id in range(total_options):
        button = random.randint(0,3)    # pick between yes, maybe, no or blank
        if button < 3:
            expected[option_id-1] += 1
            vote_scheduler(scheduler_locator, option_id, button)    
    # view votes
    votes = get_scheduler_votes(page, scheduler_locator)
    # check if votes are correctly registered
    assert votes == expected, "TS6-1: Incorrect vote results."

def test_ts9_view(page):
    poll_locator = get_poll_locator(page)
    # view votes
    votes = get_poll_votes(page, poll_locator)
    # poll should be empty with no votes
    assert(sum(votes) == 0), "TS9: Vote list is not empty."

def test_ts10_view(page):
    scheduler_locator = get_scheduler_locator(page)
    # view votes
    votes = get_scheduler_votes(page, scheduler_locator)
    # scheduler should be empty with no votes
    assert(sum(votes) == 0), "TS10: Vote list is not empty."

def test_ts11_edit(page):
    poll_locator = get_poll_locator(page)
    # find edit button
    settings = poll_locator.locator("div > .w-4\\/5 > .p-5 > .mb-4 > div").get_by_role("button")
    settings.click()
    edit = settings.locator("div").get_by_role("button", name="edit")
    edit.click()
    # fill new information
    curr_time = str(datetime.today()) # title is generated with current time stamp, so we can check if the poll we just made appeared (and not some other)
    page.get_by_role("textbox", name="Enter title...").fill("Edited Title Poll " + curr_time) # fill title
    for i in range(0, DEFAULT_POLL_OPTIONS):
        page.get_by_role("textbox", name="Enter option...").nth(i).fill("Option " + str(i+5)) # fill option(s)
        page.get_by_role("textbox", name="Enter option...").nth(i).blur()
    page.get_by_role("textbox", name="Enter description...").fill("Edited Description") # fill description

    # send the edited poll
    page.get_by_text("Edit").last.click()

    # look for edited tag
    edited = poll_locator.locator("span", has_text="Edited")
    assert edited, "Edited tag does not exists."

def test_ts12_edit(page):
    scheduler_locator = get_scheduler_locator(page)
    # find edit button
    settings = scheduler_locator.locator("div > .w-4\\/5 > .p-5 > .mb-4 > div").get_by_role("button")
    settings.click()
    edit = settings.locator("div").get_by_role("button", name="edit")
    edit.click()
    # fill new information
    curr_time = str(datetime.today())

    page.get_by_role("textbox", name="Enter title...").fill("Edited Title Scheduler " + curr_time) # fill title
    page.get_by_role("textbox", name="Enter location...").fill("Edited Location") # fill title
    for i in range(0, DEFAULT_POLL_OPTIONS):
        page.get_by_role("button", name="+ Add option").click() # click add option
        date_menu = page.get_by_role("dialog")
        date_menu.get_by_label("Next month").click() # switch to next month for more day availability
        available_dates = date_menu.get_by_label("Calendar days").all_inner_texts()[0].split('\n')
        random.shuffle(available_dates)
        first_date = available_dates[0]
        second_date = available_dates[1]
        date_menu.get_by_label("Calendar days").get_by_text(first_date, exact=True).click()
        date_menu.get_by_label("Calendar days").get_by_text(second_date, exact=True).click()
        date_menu.get_by_role("button", name="Select").click() # submit option
    page.get_by_role("textbox", name="Enter description...").fill("Edited Description") # fill description

    page.locator(".ml-1 > div > div > .ml-auto").click()
    page.locator(".ml-3.mt-3 input#showVotes").check()

    # send the edited scheduler
    page.get_by_text("Edit").last.click()

    # look for edited tag
    edited = scheduler_locator.locator("span", has_text="Edited")
    assert edited, "Edited tag does not exists."

def test_ts13_close(page):
    scheduler_locator = get_scheduler_locator(page)
    # click on the settings button
    settings = scheduler_locator.locator("div > .w-4\\/5 > .p-5 > .mb-4 > div").get_by_role("button")
    settings.click()
    # click on the close button in the settings menu
    close = settings.locator("div").get_by_role("button", name="Close")
    close.click()
    # verify the scheduler is closed by checking for the closed icon
    closed_icon = scheduler_locator.locator("div > .w-4\\/5 > .p-5 > .mb-4 > div > h2 > .tooltipcontainer > .text-orange")
    expect(closed_icon).to_be_visible()

def test_ts17_pick(page):
    scheduler_locator = page.locator(".room-event").filter(has_text="Title Scheduler").last
    # pick an option
    total_options = count_scheduler_options(scheduler_locator, picking=True)
    option_id = random.randint(1, total_options)
    scheduler_locator.get_by_role("list").locator(".grid").nth(option_id-1).get_by_role("button", name="Pick").click()
    # check if an option is picked
    picked_option = scheduler_locator.get_by_role("list").locator(".outline-green-light")
    expect(picked_option).to_be_visible()

def test_ts19_reopen(page):
    scheduler_locator = page.locator(".room-event").filter(has_text="Title Scheduler").last
    # find reopen button
    settings = scheduler_locator.locator("div > .w-4\\/5 > .p-5 > .mb-4 > div").get_by_role("button")
    settings.click()
    close = settings.locator("div").get_by_role("button", name="Reopen")
    close.click()

###################### END TEST SUITE ######################

def run(update_token):
    with sync_playwright() as playwright:
        # initialize browser
        browser = playwright.chromium.launch(headless=False, slow_mo=1000)
        if update_token:
            get_session(browser)  # only needs to be done every once in a while, if token gets updated
        room = setup_room(browser, DEFAULT_ROOM)

        test_poll = True
        test_scheduler = True

        ##### TESTS #####
        ### POLL TESTS ###
        if test_poll:
            test_ts1_create_single_choice_poll(room)
            test_ts1_create_multiple_choice_poll(room)
            test_ts5_vote(room)
            test_ts9_view(room)
            test_ts11_edit(room)

        ### SCHEDULER TESTS ###
        if test_scheduler:
            test_ts3_create_scheduler(room)
            test_ts6_vote(room)
            test_ts10_view(room)
            test_ts13_close(room)
            test_ts17_pick(room)
            test_ts19_reopen(room)
            test_ts12_edit(room)
        ### END TESTS ###

        browser.close()

run(update_token=False)