import { success, withCategory } from "chenu"

withCategory("Example Category", ({ hack, toggle }) => {
    // hack("Example Hack", "This is an example hack", () => {
    //     success("This is an example hack!")
    // })
    toggle("Example Toggle", (on) => {
        if (on) {
            success("The toggle is on!")
        } else {
            success("The toggle is off!")
        }
    })
})