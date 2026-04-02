#!/usr/bin/env python3
#
# Script for digging into synapse logs
#
import argparse
from dataclasses import dataclass
import datetime
import logging
import heapq

logger = logging.getLogger(__name__)

def parse_args():
    parser = argparse.ArgumentParser(description="""Analyse hub journalctl logs""")
    parser.add_argument('-i', '--input', type=argparse.FileType('r'), default="log.txt",
                        help="the log file to analyse (defaults to 'log.txt')")
    logging.basicConfig(level=logging.DEBUG)
    return parser.parse_args()

class Program:
    def __init__(self, args):
        self._args = args

    def run(self):
        prs = []
        for (linenr, line) in enumerate(self._args.input):
            pr = self.parse_line(line, linenr)
            if pr != None:
                prs.append(pr)
        self.prs = prs
        self.print_stats()

    def parse_line(self, line, linenr):
        # See the following url for the format of "Processed request" log lines.
        # https://github.com/element-hq/synapse/blob/52fb6e98acf8c41662d070c0803a310f7f27bc7b/synapse/http/site.py#L644

        ts, *r = line.split(' - ', 7)

        if len(r) < 6: # definitely not a "Processed request" log line
            return None

        # ts is something like "Feb 12 01:02:29 ilab1-pubhubs docker[619129]: 2026-02-12 01:02:29,374"
        
        *_, ts = ts.split(': ', 1)
        # ts is something like "2026-02-12 01:02:29,374"
        
        if ts.startswith('time='): # yivi server log line
            return None 

        try:
            time = datetime.datetime.strptime(ts, "%Y-%m-%d %H:%M:%S,%f")
        except ValueError as e:
            logger.warning(f'{self._args.input.name}:{linenr}: ignoring line, because: {e}')
            return None

        *_, r = r
        # r is now something like
        # "{None} Processed request: 0.000sec/-0.000sec (0.000sec, 0.000sec) (0.000sec/0.000sec/0) 546B 200 "GET /_synapse/client/.ph/info HTTP/1.1" "pubhubs" [0 dbevts]\n"

        username, *r = r.split(' ', 1)
        if not username.startswith('{') or not username.endswith('}'):
            return None

        username = username.strip('{}')
        if username == "None":
            username = None

        if len(r) == 0:
            logger.warning(f'{self._args.input.name}:{linenr}: weird line with just a username')
            return None

        r, = r

        prs = "Processed request: "
        
        if not r.startswith(prs):
            logger.info(f'{self._args.input.name}:{linenr}: ignoring non-processed request line {r}')
            return None

        r = r[len(prs):]

        # r is now very likely something like
        # 0.000sec/-0.000sec (0.000sec, 0.000sec) (0.000sec/0.000sec/0) 546B 200 "GET /_synapse/client/.ph/info HTTP/1.1" "pubhubs" [0 dbevts]

        bit, r = r.split('/', 1)
        processing_time = float(bit.removesuffix('sec'))

        bit, r = r.split(' (', 1)
        response_send_time = float(bit.removesuffix('sec'))

        # r is now something like
        # (0.000sec, 0.000sec) (0.000sec/0.000sec/0) 546B 200 "GET /_synapse/client/.ph/info HTTP/1.1" "pubhubs" [0 dbevts]
        bit, r = r.split(', ', 1)
        user_time = float(bit.removesuffix('sec'))

        bit, r = r.split(') (', 1)
        system_time = float(bit.removesuffix('sec'))

        bit, r = r.split('/', 1)
        db_sched_duration = float(bit.removesuffix('sec'))

        bit, r = r.split('/', 1)
        db_txn_duration = float(bit.removesuffix('sec'))

        bit, r = r.split(') ', 1)
        db_txn_count = int(bit)
        
        # r is now something like:
        # 546B 200 "GET /_synapse/client/.ph/info HTTP/1.1" "pubhubs" [0 dbevts]
        response_length_b, status_code, r = r.split(" ", 2)

        response_length = int(response_length_b.removesuffix("B"))
        assert(response_length_b == f"{response_length}B") # That is, no "KB" or "G"
        
        response_not_finished =  status_code.endswith("!")
        status_code = status_code.removesuffix("!")

        # r is now something like:
        # "GET /_synapse/client/.ph/info HTTP/1.1" "pubhubs" [0 dbevts]
        r = r.removesuffix(" dbevts]\n")
        r, dbevts = r.rsplit(" [", 1)
        dbevts = int(dbevts)

        r = r.removeprefix('"')
        method_uri, user_agent = r.split('" "', 1) # assuming here '" "' does not occur in the uri / ua

        method, uri = method_uri.split(' ', 1)

        user_agent = user_agent.removesuffix('"')

        return Pr(time=time, username=username, processing_time=processing_time,
                  response_send_time=response_send_time,
                  user_time=user_time, system_time=system_time,
                  db_sched_duration=db_sched_duration, db_txn_duration=db_txn_duration,
                  db_txn_count=db_txn_count, response_length= response_length,
                  status_code=status_code, response_not_finished=response_not_finished,
                  method=method, uri=uri, dbevts=dbevts)

    def print_stats(self):
        acc_fields = ["processing_time",
                      "response_send_time",
                      "system_time",
                      "user_time",
                      "db_sched_duration",
                      "db_txn_duration",
                      "db_txn_count",
                      "response_length",
                      "dbevts"]
        accs = {name: Accumulator(name) for name in acc_fields}

        for pr in self.prs:
            for acc in accs.values():
                acc.add(pr)
        
        print(f"Total requests: {len(self.prs)}")
        for acc in accs.values():
            acc.print_summary()


@dataclass 
class Pr:
    time : datetime.datetime 
    username : str
    processing_time : float
    response_send_time : float
    user_time : float
    system_time : float 
    db_sched_duration : float
    db_txn_duration : float
    db_txn_count : float
    response_length : float
    status_code : int
    response_not_finished : bool
    method : str
    uri : str
    dbevts : int

    def __lt__(self, other):
        return self.time.__lt__(other.time)



class Accumulator:
    def __init__(self, name):
        self.pos = 0
        self.neg = 0
        self.name = name
        self.top10 = []

    def add(self, pr):
        v = getattr(pr, self.name)
        if v >= 0:
            self.pos += v
        else:
            self.neg -= v
        
        absv = abs(v)

        if len(self.top10) < 10:
            heapq.heappush(self.top10, (absv, pr))
            return
        heapq.heappushpop(self.top10, (absv, pr))

    def print_summary(self):

        total_top_10 = 0
        top10strs = []
        while self.top10:
            absv, pr = heapq.heappop(self.top10)
            total_top_10 += absv
            top10strs.append(f"{absv:10} {pr}")

        total = abs(self.pos) + abs(self.neg)
        print(f"Total {self.name}: {self.pos:.2f} - {self.neg:.2f}. Top 10 ({total_top_10/total*100:.2f}%)")
        for s in reversed(top10strs):
            print(s)
        print()


if __name__=="__main__":
    Program(parse_args()).run()


