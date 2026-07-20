# How to Import SubTrack AI Flowchart into Draw.io

To resolve any alignment and spacing issues (so your flowchart looks **exactly** like the clean, structured columns in the template image), you can import the custom **Draw.io XML** file we built for you.

---

### Method 1: Open the Pre-built `.drawio` File (Recommended for Perfect Column Alignment)
This method loads a pixel-perfect, clean layout with side-by-side roles, straight lines, and aligned option cards.

1. **Open Draw.io**: Go to [app.diagrams.net](https://app.diagrams.net/).
2. **Open the File**:
   * Click **File** ──► **Open From** ──► **Device...**
   * Select the file: **`docs/SubTrack_AI_Flowchart.drawio`** in your project workspace.
   * *Alternatively: Simply drag-and-drop the `SubTrack_AI_Flowchart.drawio` file directly onto your Draw.io browser canvas.*

---

### Method 2: Pasting Raw XML Code
If you want to paste the XML code directly without importing the file:

1. **Open Draw.io**: Go to [app.diagrams.net](https://app.diagrams.net/).
2. **Open Edit Diagram Window**:
   * In the top menu, go to **Extras** ──► **Edit Diagram...**
3. **Paste XML**: Delete any existing code in the text area and paste the XML code from `docs/SubTrack_AI_Flowchart.drawio`.
4. **Apply**: Click **OK** or **Apply** to render the perfectly aligned flowchart.

---

### Method 3: Using the Mermaid Importer (Auto-Layout)
If you prefer to let Draw.io generate the shapes automatically using Mermaid:

1. **Open Draw.io**: Go to [app.diagrams.net](https://app.diagrams.net/).
2. **Open Mermaid Importer**:
   * In the top menu bar, click **Arrange** ──► **Insert** ──► **Advanced** ──► **Mermaid...**
3. **Paste Code**: Copy and paste the Mermaid block below and click **Insert**. Note that this layout is auto-generated and might have loose spacing.

---

### Copy this Mermaid Code Block:

```text
flowchart TD
    Start([Start]) --> IsAdmin{is admin}
    IsAdmin -->|NO| IsSubscriber{is subscriber}
    IsSubscriber -->|NO| Stop([Stop])

    IsAdmin -->|YES| AdminLogin[Login]
    IsSubscriber -->|YES| SubLogin[Login]
    
    %% Admin features
    AdminLogin --> AdminOpt1[Dashboard]
    AdminLogin --> AdminOpt2[Manage Banners]
    AdminLogin --> AdminOpt3[Manage Templates]
    AdminLogin --> AdminOpt4[Monitor Performance]
    AdminLogin --> AdminOpt5[Change Password]
    
    %% Subscriber features
    SubLogin --> SubOpt1[Dashboard]
    SubLogin --> SubOpt2[Manage Subscriptions]
    SubLogin --> SubOpt3[AI Chatbot Parser]
    SubLogin --> SubOpt4[Split Expense]
    SubLogin --> SubOpt5[Generate PDF Invoice]
    
    %% Main vertical lines connecting down to LogOut
    AdminLogin --> LogOut[LogOut]
    SubLogin --> LogOut
    
    LogOut --> Stop
```
