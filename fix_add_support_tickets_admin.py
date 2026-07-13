path = "src/components/AdminPanel.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changed_parts = []

# 1. Extend adminSubTab type + add ticket states
old1 = '''  // Sub-tabs for the Admin Panel itself to make it exceptionally organized and professional
  const [adminSubTab, setAdminSubTab] = useState<"requests" | "listings" | "settings">("requests");'''
new1 = '''  // Sub-tabs for the Admin Panel itself to make it exceptionally organized and professional
  const [adminSubTab, setAdminSubTab] = useState<"requests" | "listings" | "settings" | "tickets">("requests");

  // Support tickets states
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketActionLoadingId, setTicketActionLoadingId] = useState<string | null>(null);'''
if old1 in content:
    content = content.replace(old1, new1, 1)
    changed_parts.append("state")

# 2. Add useEffect (fetch support_tickets) + resolve/reopen handlers, right before handleUpdatePaymentConfig
old2 = '''    return () => unsubscribe();
  }, []);

  const handleUpdatePaymentConfig = async (e: React.FormEvent) => {'''
new2 = '''    return () => unsubscribe();
  }, []);

  // Listen to all customer support tickets across Gari Bazar platform
  useEffect(() => {
    const q = query(
      collection(db, "support_tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTicketsList(list);
      setLoadingTickets(false);
    }, (err) => {
      console.error("Could not fetch support tickets:", err);
      setLoadingTickets(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResolveTicket = async (ticketId: string) => {
    setTicketActionLoadingId(ticketId);
    try {
      await updateDoc(doc(db, "support_tickets", ticketId), {
        status: "resolved",
        resolvedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Could not resolve ticket:", err);
    } finally {
      setTicketActionLoadingId(null);
    }
  };

  const handleReopenTicket = async (ticketId: string) => {
    setTicketActionLoadingId(ticketId);
    try {
      await updateDoc(doc(db, "support_tickets", ticketId), {
        status: "open"
      });
    } catch (err) {
      console.error("Could not reopen ticket:", err);
    } finally {
      setTicketActionLoadingId(null);
    }
  };

  const handleUpdatePaymentConfig = async (e: React.FormEvent) => {'''
if old2 in content:
    content = content.replace(old2, new2, 1)
    changed_parts.append("effect+handlers")

# 3. Add the "Support Tickets" tab button
old3 = '''        <button
          onClick={() => setAdminSubTab("settings")}
          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            adminSubTab === "settings"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          {language === "bn" ? "আমার বিকাশ/নগদ/রকেট নম্বর" : "Edit Payment Numbers"}
        </button>
      </div>'''
new3 = '''        <button
          onClick={() => setAdminSubTab("settings")}
          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            adminSubTab === "settings"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          {language === "bn" ? "আমার বিকাশ/নগদ/রকেট নম্বর" : "Edit Payment Numbers"}
        </button>

        <button
          onClick={() => setAdminSubTab("tickets")}
          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            adminSubTab === "tickets"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          {language === "bn"
            ? `সাপোর্ট টিকেট (${ticketsList.filter(t => t.status !== "resolved").length})`
            : `Support Tickets (${ticketsList.filter(t => t.status !== "resolved").length})`}
        </button>
      </div>'''
if old3 in content:
    content = content.replace(old3, new3, 1)
    changed_parts.append("tab-button")

# 4. Add the tickets content panel
old4 = '''      ) : (

        /* 2. REFILL PENDING LISTINGS CONTROL PANEL */'''
new4 = '''      ) : adminSubTab === "tickets" ? (

        /* SUPPORT TICKETS PANEL */
        <div className="space-y-4">
          <h5 className="text-sm font-black text-slate-850 dark:text-white mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-500" />
            {language === "bn" ? "গ্রাহক সাপোর্ট টিকেট" : "Customer Support Tickets"}
          </h5>

          {loadingTickets ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border rounded-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
            </div>
          ) : ticketsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
              <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs font-bold text-slate-500">
                {language === "bn" ? "এখনো কোনো সাপোর্ট টিকেট আসেনি।" : "No support tickets yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ticketsList.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-xs font-black text-slate-800 dark:text-white">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {ticket.name || "Anonymous"}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            ticket.status === "resolved"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : "bg-amber-500/15 text-amber-500"
                          }`}
                        >
                          {ticket.status === "resolved"
                            ? (language === "bn" ? "সমাধান হয়েছে" : "Resolved")
                            : (language === "bn" ? "খোলা" : "Open")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{ticket.email || "—"}</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-2 whitespace-pre-wrap">
                        {ticket.message}
                      </p>
                      {ticket.createdAt && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(ticket.createdAt).toLocaleString(language === "bn" ? "bn-BD" : "en-US")}</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {ticket.status === "resolved" ? (
                        <button
                          onClick={() => handleReopenTicket(ticket.id)}
                          disabled={ticketActionLoadingId !== null}
                          className="p-1 px-2.5 text-[10px] font-bold text-amber-500 hover:text-white bg-amber-500/10 hover:bg-amber-500 rounded-lg border border-amber-500/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          {ticketActionLoadingId === ticket.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>{language === "bn" ? "আবার খুলুন" : "Reopen"}</span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResolveTicket(ticket.id)}
                          disabled={ticketActionLoadingId !== null}
                          className="p-1 px-2.5 text-[10px] font-bold text-emerald-500 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 rounded-lg border border-emerald-500/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          {ticketActionLoadingId === ticket.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{language === "bn" ? "সমাধান হয়েছে" : "Resolve"}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (

        /* 2. REFILL PENDING LISTINGS CONTROL PANEL */'''
if old4 in content:
    content = content.replace(old4, new4, 1)
    changed_parts.append("content-panel")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

expected = {"state", "effect+handlers", "tab-button", "content-panel"}
got = set(changed_parts)
if got == expected:
    print("[OK] AdminPanel.tsx: patched (Support Tickets tab added — view, resolve, reopen tickets)")
else:
    missing = expected - got
    print(f"[PARTIAL] এই অংশগুলো প্যাচ হয়নি: {missing} — ম্যানুয়ালি চেক করো, কোড হয়তো আগেই আলাদাভাবে পরিবর্তিত হয়েছে।")
